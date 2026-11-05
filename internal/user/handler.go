package user

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"alango/internal/audit"
	"alango/internal/auth"
	appmail "alango/internal/mail"
	"alango/internal/realtime"
	"alango/internal/safego"
	"alango/internal/upload"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

const minPasswordLen = 8
const maxPasswordBytes = 72
const maxFullNameBytes = 100

var dummyPasswordHash = func() []byte {
	h, err := bcrypt.GenerateFromPassword([]byte("dummy-constant-time-pad"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	return h
}()

type UserHandler struct {
	Service        *UserService
	JWTSecret      string
	Redis          *redis.Client
	UploadService  *upload.Service
	Hub            *realtime.Hub
	AuditService   *audit.Service
	MailSender     *appmail.Sender
	SiteURL        string
	CookieSecure   bool
	GoogleVerifier *auth.GoogleVerifier
	AppleVerifier  *auth.AppleVerifier
}

func NewUserHandler(
	service *UserService,
	jwtSecret string,
	rdb *redis.Client,
	uploadService *upload.Service,
	hub *realtime.Hub,
	auditService *audit.Service,
	mailSender *appmail.Sender,
	siteURL string,
	cookieSecure bool,
	googleVerifier *auth.GoogleVerifier,
	appleVerifier *auth.AppleVerifier,
) *UserHandler {
	return &UserHandler{
		Service:        service,
		JWTSecret:      jwtSecret,
		Redis:          rdb,
		UploadService:  uploadService,
		Hub:            hub,
		AuditService:   auditService,
		MailSender:     mailSender,
		SiteURL:        siteURL,
		CookieSecure:   cookieSecure,
		GoogleVerifier: googleVerifier,
		AppleVerifier:  appleVerifier,
	}
}

func (h *UserHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = strings.TrimSpace(req.Phone)

	if req.FullName == "" {
		http.Error(w, "full_name is required", http.StatusBadRequest)
		return
	}
	if len(req.FullName) > maxFullNameBytes {
		http.Error(w, "full_name is too long", http.StatusBadRequest)
		return
	}
	if req.Email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}
	if addr, err := mail.ParseAddress(req.Email); err != nil || addr.Address != req.Email {
		http.Error(w, "invalid email format", http.StatusBadRequest)
		return
	}
	if err := validatePasswordStrength(req.Password); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(req.Password) > maxPasswordBytes {
		http.Error(w, "password must not exceed 72 characters", http.StatusBadRequest)
		return
	}

	token, err := h.StartRegistration(r.Context(), &req)
	if err != nil {
		switch {
		case err.Error() == "email already registered":
			http.Error(w, err.Error(), http.StatusConflict)
		case errors.Is(err, ErrResendTooSoon), errors.Is(err, ErrEmailSendLimitHit):
			http.Error(w, err.Error(), http.StatusTooManyRequests)
		default:
			log.Printf("ERROR: StartRegistration failed for email %s: %v", req.Email, err)
			http.Error(w, "failed to start registration", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{"token": token})
}

func (h *UserHandler) VerifyRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Token) == "" || strings.TrimSpace(req.Code) == "" {
		http.Error(w, "token and code are required", http.StatusBadRequest)
		return
	}

	user, err := h.VerifyRegistration(r.Context(), strings.TrimSpace(req.Token), req.Code)
	if err != nil {
		switch {
		case errors.Is(err, ErrPendingNotFound):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, ErrInvalidVerifyCode):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, ErrTooManyCodeTries):
			http.Error(w, err.Error(), http.StatusTooManyRequests)
		case err.Error() == "email already registered":
			http.Error(w, err.Error(), http.StatusConflict)
		default:
			http.Error(w, "failed to complete registration", http.StatusInternalServerError)
		}
		return
	}

	h.AuditService.Log(user.ID, audit.ActionRegister, user.Email, r)

	token, err := auth.GenerateToken(user.ID, user.Role, h.JWTSecret)
	if err != nil {
		http.Error(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	refreshToken, err := auth.IssueRefreshToken(r.Context(), h.Redis, user.ID)
	if err != nil {
		http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"user_info": ToUserResponse(user),
		"email":     user.Email,
		"token":     token,
	}
	if isMobileClient(r) {
		resp["refresh_token"] = refreshToken
	} else {
		h.setRefreshCookie(w, refreshToken)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) ResendRegisterCode(w http.ResponseWriter, r *http.Request) {
	var req RegisterResendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Token) == "" {
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}

	if err := h.ResendRegistrationCode(r.Context(), strings.TrimSpace(req.Token)); err != nil {
		switch {
		case errors.Is(err, ErrPendingNotFound):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, ErrResendTooSoon), errors.Is(err, ErrEmailSendLimitHit):
			http.Error(w, err.Error(), http.StatusTooManyRequests)
		default:
			http.Error(w, "failed to resend code", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if isLoginLocked(r.Context(), h.Redis, req.Email) {
		if u, err := h.Service.GetUserByEmail(req.Email); err == nil {
			h.AuditService.Log(u.ID, audit.ActionLoginFailed, "rate_limited", r)
		}
		http.Error(w, "too many failed login attempts, try again later", http.StatusTooManyRequests)
		return
	}

	user, err := h.Service.GetUserByEmail(req.Email)
	if err != nil {
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(req.Password))
		recordLoginFailure(r.Context(), h.Redis, req.Email)
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	if user.Password == "" {
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(req.Password))
		recordLoginFailure(r.Context(), h.Redis, req.Email)
		h.AuditService.Log(user.ID, audit.ActionLoginFailed, "no_password_set", r)
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		recordLoginFailure(r.Context(), h.Redis, req.Email)
		h.AuditService.Log(user.ID, audit.ActionLoginFailed, "wrong_password", r)
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	if !user.Active {
		recordLoginFailure(r.Context(), h.Redis, req.Email)
		h.AuditService.Log(user.ID, audit.ActionLoginFailed, "account_disabled", r)
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	clearLoginFailures(r.Context(), h.Redis, req.Email)

	h.AuditService.Log(user.ID, audit.ActionLogin, "", r)

	token, err := auth.GenerateToken(user.ID, user.Role, h.JWTSecret)
	if err != nil {
		http.Error(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	refreshToken, err := auth.IssueRefreshToken(r.Context(), h.Redis, user.ID)
	if err != nil {
		http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"user_info": ToUserResponse(user),
		"email":     user.Email,
		"token":     token,
	}
	if isMobileClient(r) {
		resp["refresh_token"] = refreshToken
	} else {
		h.setRefreshCookie(w, refreshToken)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	if h.GoogleVerifier == nil || !h.GoogleVerifier.Enabled() {
		http.Error(w, "google sign-in is not available", http.StatusServiceUnavailable)
		return
	}

	var req GoogleLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.IDToken) == "" {
		http.Error(w, "id_token is required", http.StatusBadRequest)
		return
	}

	ident, err := h.GoogleVerifier.Verify(r.Context(), req.IDToken)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidGoogleToken) {
			http.Error(w, "invalid google token", http.StatusUnauthorized)
			return
		}
		http.Error(w, "could not verify google account, try again", http.StatusServiceUnavailable)
		return
	}

	user, err := h.Service.FindOrCreateByGoogle(ident.Sub, ident.Email, ident.Name, ident.Picture)
	if err != nil {
		if errors.Is(err, ErrGoogleAlreadyLinked) {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		http.Error(w, "failed to sign in with google", http.StatusInternalServerError)
		return
	}

	if !user.Active {
		h.AuditService.Log(user.ID, audit.ActionLoginFailed, "google:account_disabled", r)
		http.Error(w, "account disabled", http.StatusForbidden)
		return
	}

	h.AuditService.Log(user.ID, audit.ActionLogin, "google", r)

	token, err := auth.GenerateToken(user.ID, user.Role, h.JWTSecret)
	if err != nil {
		http.Error(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	refreshToken, err := auth.IssueRefreshToken(r.Context(), h.Redis, user.ID)
	if err != nil {
		http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"user_info": ToUserResponse(user),
		"email":     user.Email,
		"token":     token,
	}
	if isMobileClient(r) {
		resp["refresh_token"] = refreshToken
	} else {
		h.setRefreshCookie(w, refreshToken)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) AppleLogin(w http.ResponseWriter, r *http.Request) {
	if h.AppleVerifier == nil || !h.AppleVerifier.Enabled() {
		http.Error(w, "sign in with apple is not available", http.StatusServiceUnavailable)
		return
	}

	var req AppleLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.IdentityToken) == "" {
		http.Error(w, "identity_token is required", http.StatusBadRequest)
		return
	}
	if len(strings.TrimSpace(req.FullName)) > maxFullNameBytes {
		http.Error(w, "full_name is too long", http.StatusBadRequest)
		return
	}

	ident, err := h.AppleVerifier.Verify(r.Context(), req.IdentityToken)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidAppleToken) {
			http.Error(w, "invalid apple token", http.StatusUnauthorized)
			return
		}
		http.Error(w, "could not verify apple account, try again", http.StatusServiceUnavailable)
		return
	}

	user, err := h.Service.FindOrCreateByApple(ident.Sub, ident.Email, req.FullName, ident.EmailVerified, ident.IsPrivateEmail)
	if err != nil {
		switch {
		case errors.Is(err, ErrAppleAlreadyLinked):
			http.Error(w, err.Error(), http.StatusConflict)
		case errors.Is(err, ErrAppleNoEmail):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, ErrAppleNameRequired):
			http.Error(w, err.Error(), http.StatusUnprocessableEntity)
		default:
			http.Error(w, "failed to sign in with apple", http.StatusInternalServerError)
		}
		return
	}

	if !user.Active {
		h.AuditService.Log(user.ID, audit.ActionLoginFailed, "apple:account_disabled", r)
		http.Error(w, "account disabled", http.StatusForbidden)
		return
	}

	if code := strings.TrimSpace(req.AuthorizationCode); code != "" && h.AppleVerifier.TokenAPIEnabled() {
		if rt, err := h.AppleVerifier.ExchangeCode(r.Context(), code); err != nil {
			log.Println("apple: code exchange failed (sign-in proceeds):", err)
		} else if err := h.Service.SaveAppleRefreshToken(user.ID, rt); err != nil {
			log.Println("apple: saving refresh token failed:", err)
		}
	}

	h.AuditService.Log(user.ID, audit.ActionLogin, "apple", r)

	token, err := auth.GenerateToken(user.ID, user.Role, h.JWTSecret)
	if err != nil {
		http.Error(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	refreshToken, err := auth.IssueRefreshToken(r.Context(), h.Redis, user.ID)
	if err != nil {
		http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"user_info": ToUserResponse(user),
		"email":     user.Email,
		"token":     token,
	}
	if isMobileClient(r) {
		resp["refresh_token"] = refreshToken
	} else {
		h.setRefreshCookie(w, refreshToken)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}
	if addr, err := mail.ParseAddress(req.Email); err != nil || addr.Address != req.Email {
		http.Error(w, "invalid email format", http.StatusBadRequest)
		return
	}

	if err := h.StartPasswordReset(r.Context(), req.Email); err != nil {
		if errors.Is(err, ErrResetTooSoon) || errors.Is(err, ErrResetSendLimitHit) {
			http.Error(w, err.Error(), http.StatusTooManyRequests)
			return
		}
		http.Error(w, "failed to send password reset email", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) ConfirmPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Password) > maxPasswordBytes {
		http.Error(w, "password must not exceed 72 characters", http.StatusBadRequest)
		return
	}

	userID, err := h.ConfirmPasswordReset(r.Context(), req.Token, req.Password)
	if err != nil {
		if errors.Is(err, ErrResetTokenInvalid) || errors.Is(err, ErrWeakPassword) || err.Error() == "password must be at least 8 characters" {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to reset password", http.StatusInternalServerError)
		return
	}

	h.AuditService.Log(userID, audit.ActionPasswordReset, "", r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	rt := strings.TrimSpace(body.RefreshToken)
	if rt == "" {
		rt = readRefreshCookie(r)
	}
	if rt == "" {
		http.Error(w, "refresh_token is required", http.StatusBadRequest)
		return
	}

	userID, newRefreshToken, err := auth.RotateRefreshToken(r.Context(), h.Redis, rt)
	if err != nil {
		var reuseErr *auth.ReuseDetectedError
		if errors.As(err, &reuseErr) {
			h.AuditService.Log(reuseErr.UserID, audit.ActionRefreshReuseDetected, "", r)
		}
		if errors.Is(err, auth.ErrInvalidRefreshToken) {
			h.clearRefreshCookie(w)
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		http.Error(w, "failed to refresh session", http.StatusInternalServerError)
		return
	}

	user, err := h.Service.GetUserByID(userID)
	if err != nil || !user.Active {
		_ = auth.RevokeRefreshToken(r.Context(), h.Redis, newRefreshToken)
		h.clearRefreshCookie(w)
		http.Error(w, "account disabled or not found", http.StatusUnauthorized)
		return
	}

	accessToken, err := auth.GenerateToken(user.ID, user.Role, h.JWTSecret)
	if err != nil {
		http.Error(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{"token": accessToken}
	if isMobileClient(r) {
		resp["refresh_token"] = newRefreshToken
	} else {
		h.setRefreshCookie(w, newRefreshToken)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) Logout(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetClaims(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.ID != "" && claims.ExpiresAt != nil {
		ttl := time.Until(claims.ExpiresAt.Time)
		if err := auth.Blacklist(r.Context(), h.Redis, claims.ID, ttl); err != nil {
			http.Error(w, "failed to revoke token", http.StatusInternalServerError)
			return
		}
	}

	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	rt := strings.TrimSpace(body.RefreshToken)
	if rt == "" {
		rt = readRefreshCookie(r)
	}
	if rt != "" {
		_ = auth.RevokeRefreshToken(r.Context(), h.Redis, rt)
	}
	h.clearRefreshCookie(w)

	if isMobileClient(r) {
		_ = h.Service.SetPushToken(claims.UserID, "")
	}

	if h.Hub != nil {
		h.Hub.CloseUser(claims.UserID)
	}

	h.AuditService.Log(claims.UserID, audit.ActionLogout, "", r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.Service.GetUserByID(userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ToUserResponse(user))
}

func (h *UserHandler) UpdatePushToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdatePushTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.Service.SetPushToken(userID, strings.TrimSpace(req.Token)); err != nil {
		http.Error(w, "failed to save push token", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, upload.MaxUploadSize+1024)
	if err := r.ParseMultipartForm(upload.MaxUploadSize); err != nil {
		http.Error(w, upload.ErrFileTooLarge.Error(), http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "photo file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	url, err := h.UploadService.SaveImage(file, header)
	if err != nil {
		if errors.Is(err, upload.ErrFileTooLarge) {
			http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		if errors.Is(err, upload.ErrInvalidType) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to save photo", http.StatusInternalServerError)
		return
	}

	existing, err := h.Service.GetUserByID(userID)
	if err != nil {
		_ = h.UploadService.DeleteImage(url)
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	oldPhoto := existing.Photo

	user, err := h.Service.UpdateProfile(userID, &UpdateProfileRequest{Photo: &url})
	if err != nil {
		_ = h.UploadService.DeleteImage(url)
		http.Error(w, "failed to update profile", http.StatusInternalServerError)
		return
	}

	if oldPhoto != "" && oldPhoto != url {
		_ = h.UploadService.DeleteImage(oldPhoto)
	}

	h.AuditService.Log(userID, audit.ActionAvatarUpload, url, r)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ToUserResponse(user))
}

func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.FullName != nil {
		trimmed := strings.TrimSpace(*req.FullName)
		if trimmed == "" {
			http.Error(w, "full_name is required", http.StatusBadRequest)
			return
		}
		if len(trimmed) > maxFullNameBytes {
			http.Error(w, "full_name is too long", http.StatusBadRequest)
			return
		}
		req.FullName = &trimmed
	}

	before, _ := h.Service.GetUserByID(userID)

	if req.Photo != nil && h.UploadService != nil {
		currentPhoto := ""
		if before != nil {
			currentPhoto = before.Photo
		}
		if h.UploadService.IsOwnUpload(*req.Photo) && *req.Photo != currentPhoto {
			http.Error(w, "use POST /api/profile/avatar to set an uploaded photo", http.StatusBadRequest)
			return
		}
	}

	user, err := h.Service.UpdateProfile(userID, &req)
	if err != nil {
		http.Error(w, "failed to update profile", http.StatusInternalServerError)
		return
	}

	if before != nil && req.Photo != nil && before.Photo != "" && before.Photo != user.Photo && h.UploadService != nil {
		_ = h.UploadService.DeleteImage(before.Photo)
	}

	h.AuditService.Log(userID, audit.ActionProfileUpdate, "", r)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ToUserResponse(user))
}

func (h *UserHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	deletedUser, uploadedURLs, err := h.Service.DeleteAccount(userID)
	if err != nil {
		http.Error(w, "failed to delete account", http.StatusInternalServerError)
		return
	}

	if claims, ok := auth.GetClaims(r); ok && claims.ID != "" && claims.ExpiresAt != nil {
		ttl := time.Until(claims.ExpiresAt.Time)
		_ = auth.Blacklist(r.Context(), h.Redis, claims.ID, ttl)
	}
	_ = auth.RevokeAllRefreshFamilies(r.Context(), h.Redis, userID)
	h.clearRefreshCookie(w)

	if h.Hub != nil {
		h.Hub.CloseUser(userID)
	}

	if h.UploadService != nil {
		safego.Go(func() {
			for _, u := range uploadedURLs {
				_ = h.UploadService.DeleteImage(u)
			}
		})
	}

	if deletedUser != nil && deletedUser.AppleRefreshToken != nil && *deletedUser.AppleRefreshToken != "" &&
		h.AppleVerifier != nil && h.AppleVerifier.TokenAPIEnabled() {
		rt := *deletedUser.AppleRefreshToken
		safego.Go(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := h.AppleVerifier.RevokeToken(ctx, rt); err != nil {
				log.Println("apple: token revoke on account delete failed:", err)
			}
		})
	}

	w.WriteHeader(http.StatusNoContent)
}
