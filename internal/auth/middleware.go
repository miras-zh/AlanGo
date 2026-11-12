package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/redis/go-redis/v9"
)

type contextKey string

const (
	UserIDKey contextKey = "user_id"
	RoleKey   contextKey = "role"
	ClaimsKey contextKey = "claims"
)

type AccountActiveChecker func(userID uint) (bool, error)

func AuthMiddleware(secret, previousSecret string, rdb *redis.Client, isActive AccountActiveChecker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "missing authorization header", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "invalid authorization header", http.StatusUnauthorized)
				return
			}

			claims, err := ValidateToken(parts[1], secret, previousSecret)
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}

			if claims.ID != "" && rdb != nil {
				if revoked, err := IsBlacklisted(r.Context(), rdb, claims.ID); err == nil && revoked {
					http.Error(w, "token has been revoked", http.StatusUnauthorized)
					return
				}
			}

			if isActive != nil {
				active, err := isActive(claims.UserID)
				if err != nil || !active {
					http.Error(w, "account disabled", http.StatusForbidden)
					return
				}
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)
			ctx = context.WithValue(ctx, ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuthMiddleware attaches the user to the request when a valid,
// non-revoked bearer token is present, and otherwise lets the request through
// anonymously (used by public endpoints that also serve signed-in users,
// e.g. creating a booking).
func OptionalAuthMiddleware(secret, previousSecret string, rdb *redis.Client, isActive AccountActiveChecker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			parts := strings.SplitN(r.Header.Get("Authorization"), " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				next.ServeHTTP(w, r)
				return
			}
			claims, err := ValidateToken(parts[1], secret, previousSecret)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if claims.ID != "" && rdb != nil {
				if revoked, err := IsBlacklisted(r.Context(), rdb, claims.ID); err == nil && revoked {
					next.ServeHTTP(w, r)
					return
				}
			}
			if isActive != nil {
				if active, err := isActive(claims.UserID); err != nil || !active {
					next.ServeHTTP(w, r)
					return
				}
			}
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)
			ctx = context.WithValue(ctx, ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
