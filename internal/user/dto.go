package user

import "time"

type RegisterRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	City     string `json:"city"`
	Photo    string `json:"photo"`
}

type RegisterVerifyRequest struct {
	Token string `json:"token"`
	Code  string `json:"code"`
}

type RegisterResendRequest struct {
	Token string `json:"token"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type GoogleLoginRequest struct {
	IDToken string `json:"id_token"`
}

type AppleLoginRequest struct {
	IdentityToken     string `json:"identity_token"`
	FullName          string `json:"full_name"`
	AuthorizationCode string `json:"authorization_code"`
}

type PasswordResetRequest struct {
	Email string `json:"email"`
}

type PasswordResetConfirmRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type UpdateProfileRequest struct {
	FullName *string `json:"full_name"`
	Phone    *string `json:"phone"`
	City     *string `json:"city"`
	Photo    *string `json:"photo"`
}

type UpdatePushTokenRequest struct {
	Token string `json:"token"`
}

type UserResponse struct {
	ID            uint      `json:"id"`
	FullName      string    `json:"full_name"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	PhoneVerified bool      `json:"phone_verified"`
	City          string    `json:"city"`
	Photo         string    `json:"photo"`
	Role          string    `json:"role"`
	BusinessRole  string    `json:"business_role"`
	Type          string    `json:"type"`
	Plan          string    `json:"plan"`
	CreatedAt     time.Time `json:"created_at"`
}

func ToUserResponse(user *User) UserResponse {
	return UserResponse{
		ID:            user.ID,
		FullName:      user.FullName,
		Email:         user.Email,
		Phone:         user.Phone,
		PhoneVerified: user.PhoneVerified,
		City:          user.City,
		Photo:         user.Photo,
		Role:          user.Role,
		BusinessRole:  user.BusinessRole,
		Type:          user.Type,
		Plan:          user.Plan,
		CreatedAt:     user.CreatedAt,
	}
}
