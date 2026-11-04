package router

import (
	"context"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const rateLimitWindow = time.Minute

var (
	rateLimitMax              = envInt("RATE_LIMIT_MAX", 120)
	loginRateLimitMax         = envInt("LOGIN_RATE_LIMIT_MAX", 20)
	passwordResetRateLimitMax = envInt("PASSWORD_RESET_RATE_LIMIT_MAX", 5)
	publicFormRateLimitMax    = envInt("PUBLIC_FORM_RATE_LIMIT_MAX", 10)
)

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

var fixedWindowScript = redis.NewScript(`
local c = redis.call('INCR', KEYS[1])
if c == 1 or redis.call('PTTL', KEYS[1]) == -1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return c
`)

func allowFixedWindow(ctx context.Context, rdb *redis.Client, key string, window time.Duration) (int64, bool) {
	if rdb == nil {
		return 0, false
	}
	n, err := fixedWindowScript.Run(ctx, rdb, []string{key}, window.Milliseconds()).Int64()
	if err != nil {
		return 0, false
	}
	return n, true
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

func withRateLimit(next http.Handler, rdb *redis.Client) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := "ratelimit:" + clientIP(r)
		count, ok := allowFixedWindow(r.Context(), rdb, key, rateLimitWindow)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		if count > int64(rateLimitMax) {
			http.Error(w, "too many requests, slow down", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withLoginRateLimit(next http.Handler, rdb *redis.Client) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := "ratelimit:login:" + clientIP(r)
		count, ok := allowFixedWindow(r.Context(), rdb, key, time.Minute)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		if count > int64(loginRateLimitMax) {
			http.Error(w, "too many login attempts from this address, slow down", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withPasswordResetRateLimit(next http.Handler, rdb *redis.Client) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := "ratelimit:pwreset:" + clientIP(r)
		count, ok := allowFixedWindow(r.Context(), rdb, key, time.Minute)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		if count > int64(passwordResetRateLimitMax) {
			http.Error(w, "too many password reset requests from this address, slow down", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withPublicFormRateLimit(scope string, next http.Handler, rdb *redis.Client) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := "ratelimit:form:" + scope + ":" + clientIP(r)
		count, ok := allowFixedWindow(r.Context(), rdb, key, time.Minute)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		if count > int64(publicFormRateLimitMax) {
			http.Error(w, "too many requests from this address, slow down", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
