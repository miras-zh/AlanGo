package router

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"

	"alango/config"
	"alango/internal/netutil"

	"github.com/redis/go-redis/v9"
)

const (
	rateLimitWindow   = time.Minute
	maxMemRateBuckets = 50000
)

type memBucket struct {
	count     int64
	expiresAt time.Time
}

type RateLimiter struct {
	rdb              *redis.Client
	proxyChecker     *netutil.TrustedProxyChecker
	globalMax        int
	loginMax         int
	passwordResetMax int
	publicFormMax    int

	memMu      sync.Mutex
	memBuckets map[string]memBucket
}

func NewRateLimiter(rdb *redis.Client, cfg *config.Config) *RateLimiter {
	rl := &RateLimiter{
		rdb:              rdb,
		proxyChecker:     netutil.NewTrustedProxyChecker("127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"),
		globalMax:        120,
		loginMax:         20,
		passwordResetMax: 5,
		publicFormMax:    10,
		memBuckets:       make(map[string]memBucket),
	}
	if cfg != nil {
		if cfg.TrustedProxies != "" {
			rl.proxyChecker = netutil.NewTrustedProxyChecker(cfg.TrustedProxies)
		}
		if cfg.RateLimitMax > 0 {
			rl.globalMax = cfg.RateLimitMax
		}
		if cfg.LoginRateLimitMax > 0 {
			rl.loginMax = cfg.LoginRateLimitMax
		}
		if cfg.PasswordResetRateLimitMax > 0 {
			rl.passwordResetMax = cfg.PasswordResetRateLimitMax
		}
		if cfg.PublicFormRateLimitMax > 0 {
			rl.publicFormMax = cfg.PublicFormRateLimitMax
		}
	}
	return rl
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
		log.Printf("ratelimit: redis error for %s: %v", key, err)
		return 0, false
	}
	return n, true
}

func (rl *RateLimiter) allowMemWindow(key string, window time.Duration) int64 {
	now := time.Now()
	rl.memMu.Lock()
	defer rl.memMu.Unlock()

	if len(rl.memBuckets) >= maxMemRateBuckets {
		for k, b := range rl.memBuckets {
			if !now.Before(b.expiresAt) {
				delete(rl.memBuckets, k)
			}
		}
		if len(rl.memBuckets) >= maxMemRateBuckets {
			for k := range rl.memBuckets {
				delete(rl.memBuckets, k)
				break
			}
		}
	}

	b, ok := rl.memBuckets[key]
	if !ok || !now.Before(b.expiresAt) {
		b = memBucket{count: 1, expiresAt: now.Add(window)}
		rl.memBuckets[key] = b
		return 1
	}
	b.count++
	rl.memBuckets[key] = b
	return b.count
}

func (rl *RateLimiter) limit(prefix string, max int, msg string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := prefix + rl.proxyChecker.ClientIP(r)
		count, ok := allowFixedWindow(r.Context(), rl.rdb, key, rateLimitWindow)
		if !ok {
			count = rl.allowMemWindow(key, rateLimitWindow)
		}
		if count > int64(max) {
			http.Error(w, msg, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) Global(next http.Handler) http.Handler {
	return rl.limit("ratelimit:", rl.globalMax, "too many requests, slow down", next)
}

func (rl *RateLimiter) Login(next http.Handler) http.Handler {
	return rl.limit("ratelimit:login:", rl.loginMax, "too many login attempts from this address, slow down", next)
}

func (rl *RateLimiter) PasswordReset(next http.Handler) http.Handler {
	return rl.limit("ratelimit:pwreset:", rl.passwordResetMax, "too many password reset requests from this address, slow down", next)
}

func (rl *RateLimiter) PublicForm(scope string, next http.Handler) http.Handler {
	return rl.limit("ratelimit:form:"+scope+":", rl.publicFormMax, "too many requests from this address, slow down", next)
}
