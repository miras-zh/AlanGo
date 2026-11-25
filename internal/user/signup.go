package user

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
	"unicode"

	appmail "alango/internal/mail"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	pendingRegTTL        = 15 * time.Minute
	resendCooldown       = 60 * time.Second
	maxSendPerEmail      = 5
	emailSendWindow      = time.Hour
	maxCodeVerifyTries   = 5
	verificationCodeLen  = 6
	registrationTokenLen = 16
)

var (
	ErrWeakPassword       = errors.New("password must contain letters, digits and a special character")
	ErrPendingNotFound    = errors.New("registration not found or expired")
	ErrInvalidVerifyCode  = errors.New("invalid verification code")
	ErrTooManyCodeTries   = errors.New("too many invalid code attempts, please sign up again")
	ErrResendTooSoon      = errors.New("verification code was just sent, please wait")
	ErrEmailSendLimitHit  = errors.New("too many verification emails requested for this address")
)

type pendingRegistration struct {
	FullName     string `json:"full_name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	City         string `json:"city"`
	Photo        string `json:"photo"`
	PasswordHash string `json:"password_hash"`
	CodeHash     string `json:"code_hash"`
	Attempts     int    `json:"attempts"`
}

func pendingRegKey(token string) string   { return "reg:pending:" + token }
func pendingAttemptKey(token string) string { return "reg:attempts:" + token }
func resendCooldownKey(email string) string { return "reg:cooldown:" + strings.ToLower(email) }
func emailSendCountKey(email string) string { return "reg:sends:" + strings.ToLower(email) }

func validatePasswordStrength(password string) error {
	if len(password) < minPasswordLen {
		return errors.New("password must be at least 8 characters")
	}
	var hasLetter, hasDigit, hasSpecial bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}
	if !hasLetter || !hasDigit || !hasSpecial {
		return ErrWeakPassword
	}
	return nil
}

func generateVerificationCode() (string, error) {
	max := big.NewInt(1_000_000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", verificationCodeLen, n.Int64()), nil
}

func generateRegistrationToken() (string, error) {
	b := make([]byte, registrationTokenLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

func (s *UserService) emailExists(email string) (bool, error) {
	var count int64
	err := s.DB.Model(&User{}).Where("LOWER(email) = LOWER(?)", email).Count(&count).Error
	return count > 0, err
}

func checkEmailSendAllowed(ctx context.Context, rdb *redis.Client, email string) error {
	cooldownKey := resendCooldownKey(email)
	cntKey := emailSendCountKey(email)

	if authGuardMem.exists(cooldownKey) {
		return ErrResendTooSoon
	}
	if authGuardMem.getCount(cntKey) >= maxSendPerEmail {
		return ErrEmailSendLimitHit
	}
	if rdb == nil {
		return nil
	}
	if exists, err := rdb.Exists(ctx, cooldownKey).Result(); err == nil && exists > 0 {
		return ErrResendTooSoon
	}
	if sends, err := rdb.Get(ctx, cntKey).Int(); err == nil && sends >= maxSendPerEmail {
		return ErrEmailSendLimitHit
	}
	return nil
}

func recordEmailSend(ctx context.Context, rdb *redis.Client, email string) {
	cooldownKey := resendCooldownKey(email)
	cntKey := emailSendCountKey(email)
	authGuardMem.setFlag(cooldownKey, resendCooldown)
	authGuardMem.incr(cntKey, emailSendWindow)

	if rdb == nil {
		return
	}
	_ = rdb.Set(ctx, cooldownKey, "1", resendCooldown).Err()
	if n, err := rdb.Incr(ctx, cntKey).Result(); err == nil && n == 1 {
		_ = rdb.Expire(ctx, cntKey, emailSendWindow).Err()
	}
}

func sendVerificationCode(sender *appmail.Sender, email, fullName, code string) error {
	subject := "Код подтверждения регистрации"
	return sender.SendTemplate([]string{email}, subject, appmail.TemplateData{
		Title:     subject,
		Name:      fullName,
		Message:   "Введите этот код, чтобы завершить регистрацию. Код действителен 15 минут.\nЕсли вы не запрашивали регистрацию, просто проигнорируйте это письмо.",
		Highlight: code,
	})
}

func (h *UserHandler) StartRegistration(ctx context.Context, req *RegisterRequest) (string, error) {
	if h.Redis == nil {
		return "", errors.New("registration storage unavailable")
	}
	exists, err := h.Service.emailExists(req.Email)
	if err != nil {
		return "", err
	}
	if exists {
		return "", errors.New("email already registered")
	}

	if err := checkEmailSendAllowed(ctx, h.Redis, req.Email); err != nil {
		return "", err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	code, err := generateVerificationCode()
	if err != nil {
		return "", err
	}

	token, err := generateRegistrationToken()
	if err != nil {
		return "", err
	}

	pending := pendingRegistration{
		FullName:     req.FullName,
		Email:        req.Email,
		Phone:        req.Phone,
		City:         req.City,
		Photo:        req.Photo,
		PasswordHash: string(passwordHash),
		CodeHash:     hashCode(code),
	}
	payload, err := json.Marshal(pending)
	if err != nil {
		return "", err
	}

	if err := h.Redis.Set(ctx, pendingRegKey(token), payload, pendingRegTTL).Err(); err != nil {
		return "", err
	}

	if err := sendVerificationCode(h.MailSender, req.Email, req.FullName, code); err != nil {
		_ = h.Redis.Del(ctx, pendingRegKey(token)).Err()
		return "", err
	}

	recordEmailSend(ctx, h.Redis, req.Email)
	return token, nil
}

func (h *UserHandler) VerifyRegistration(ctx context.Context, token, code string) (*User, error) {
	if h.Redis == nil {
		return nil, errors.New("registration storage unavailable")
	}
	key := pendingRegKey(token)
	attKey := pendingAttemptKey(token)
	raw, err := h.Redis.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, ErrPendingNotFound
	}
	if err != nil {
		return nil, err
	}

	var pending pendingRegistration
	if err := json.Unmarshal(raw, &pending); err != nil {
		return nil, err
	}

	givenHash := hashCode(strings.TrimSpace(code))
	if subtle.ConstantTimeCompare([]byte(givenHash), []byte(pending.CodeHash)) != 1 {
		attempts, err := h.Redis.Incr(ctx, attKey).Result()
		if err != nil {
			return nil, err
		}
		if attempts == 1 {
			ttl, ttlErr := h.Redis.TTL(ctx, key).Result()
			if ttlErr != nil || ttl <= 0 {
				ttl = pendingRegTTL
			}
			_ = h.Redis.Expire(ctx, attKey, ttl).Err()
		}
		if attempts >= maxCodeVerifyTries {
			_ = h.Redis.Del(ctx, key, attKey).Err()
			return nil, ErrTooManyCodeTries
		}
		return nil, ErrInvalidVerifyCode
	}

	user := &User{
		FullName: pending.FullName,
		Email:    pending.Email,
		Phone:    pending.Phone,
		City:     pending.City,
		Photo:    pending.Photo,
		Password: pending.PasswordHash,
	}
	if err := h.Service.createUserWithHashedPassword(user); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || err.Error() == "email already registered" {
			_ = h.Redis.Del(ctx, key, attKey).Err()
			return nil, errors.New("email already registered")
		}
		return nil, err
	}
	_ = h.Redis.Del(ctx, key, attKey).Err()
	return user, nil
}

func (h *UserHandler) ResendRegistrationCode(ctx context.Context, token string) error {
	if h.Redis == nil {
		return errors.New("registration storage unavailable")
	}
	key := pendingRegKey(token)
	raw, err := h.Redis.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return ErrPendingNotFound
	}
	if err != nil {
		return err
	}

	var pending pendingRegistration
	if err := json.Unmarshal(raw, &pending); err != nil {
		return err
	}

	if err := checkEmailSendAllowed(ctx, h.Redis, pending.Email); err != nil {
		return err
	}

	code, err := generateVerificationCode()
	if err != nil {
		return err
	}

	pending.CodeHash = hashCode(code)
	pending.Attempts = 0
	updated, err := json.Marshal(pending)
	if err != nil {
		return err
	}

	if err := h.Redis.Set(ctx, key, updated, pendingRegTTL).Err(); err != nil {
		return err
	}
	_ = h.Redis.Del(ctx, pendingAttemptKey(token)).Err()

	if err := sendVerificationCode(h.MailSender, pending.Email, pending.FullName, code); err != nil {
		return err
	}

	recordEmailSend(ctx, h.Redis, pending.Email)
	return nil
}
