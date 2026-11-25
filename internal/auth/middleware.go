package auth

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type contextKey string

const (
	UserIDKey contextKey = "user_id"
	RoleKey   contextKey = "role"
	ClaimsKey contextKey = "claims"

	activeCachePrefix = "auth:active:"
	activeCacheTTL    = 60 * time.Second
)

type AccountActiveChecker func(userID uint) (bool, error)

// InvalidateActiveCache clears the cached active status for userID.
func InvalidateActiveCache(ctx context.Context, rdb *redis.Client, userID uint) {
	if rdb == nil || userID == 0 {
		return
	}
	_ = rdb.Del(ctx, activeCachePrefix+strconv.FormatUint(uint64(userID), 10)).Err()
}

func checkAccountActive(ctx context.Context, rdb *redis.Client, userID uint, isActive AccountActiveChecker) (bool, error) {
	if isActive == nil {
		return true, nil
	}
	key := activeCachePrefix + strconv.FormatUint(uint64(userID), 10)
	if rdb != nil {
		if val, err := rdb.Get(ctx, key).Result(); err == nil {
			return val == "1", nil
		}
	}
	active, err := isActive(userID)
	if err != nil {
		return false, err
	}
	if rdb != nil {
		v := "0"
		if active {
			v = "1"
		}
		_ = rdb.Set(ctx, key, v, activeCacheTTL).Err()
	}
	return active, nil
}

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
				revoked, err := IsBlacklisted(r.Context(), rdb, claims.ID)
				if err != nil {
					log.Printf("auth: blacklist check failed: %v", err)
					http.Error(w, "authentication service unavailable", http.StatusServiceUnavailable)
					return
				}
				if revoked {
					http.Error(w, "token has been revoked", http.StatusUnauthorized)
					return
				}
			}

			active, err := checkAccountActive(r.Context(), rdb, claims.UserID, isActive)
			if err != nil || !active {
				http.Error(w, "account disabled", http.StatusForbidden)
				return
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
				revoked, err := IsBlacklisted(r.Context(), rdb, claims.ID)
				if err != nil {
					log.Printf("auth: optional blacklist check failed: %v", err)
					next.ServeHTTP(w, r)
					return
				}
				if revoked {
					next.ServeHTTP(w, r)
					return
				}
			}
			if active, err := checkAccountActive(r.Context(), rdb, claims.UserID, isActive); err != nil || !active {
				next.ServeHTTP(w, r)
				return
			}
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)
			ctx = context.WithValue(ctx, ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
