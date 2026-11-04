package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AccessTokenTTL is deliberately short (30 minutes) because a refresh token
// (see refresh.go) handles long-lived sessions — a leaked access token Ages
// out quickly even if logout wasn't called.
const AccessTokenTTL = 30 * time.Minute

type Claims struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateToken(userID uint, role, secret string) (string, error) {
	jti, err := generateJTI()
	if err != nil {
		return "", err
	}

	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func generateJTI() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// ValidateToken verifies tokenString against secret, falling back to
// previousSecret when non-empty for zero-downtime JWT secret rotation.
func ValidateToken(tokenString, secret, previousSecret string) (*Claims, error) {
	claims, err := parseWithSecret(tokenString, secret)
	if err == nil || previousSecret == "" {
		return claims, err
	}
	return parseWithSecret(tokenString, previousSecret)
}

func parseWithSecret(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
