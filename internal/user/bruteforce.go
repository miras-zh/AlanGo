package user

import (
	"context"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	loginFailPrefix = "login_fail:"
	maxLoginFails   = 5
	loginFailWindow = 15 * time.Minute
)

func loginFailKey(email string) string {
	return loginFailPrefix + strings.ToLower(strings.TrimSpace(email))
}

func isLoginLocked(ctx context.Context, rdb *redis.Client, email string) bool {
	if rdb == nil {
		return false
	}
	n, err := rdb.Get(ctx, loginFailKey(email)).Int()
	if err != nil {
		return false
	}
	return n >= maxLoginFails
}

func recordLoginFailure(ctx context.Context, rdb *redis.Client, email string) {
	if rdb == nil {
		return
	}
	key := loginFailKey(email)
	n, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		return
	}
	if n == 1 {
		_ = rdb.Expire(ctx, key, loginFailWindow).Err()
	}
}

func clearLoginFailures(ctx context.Context, rdb *redis.Client, email string) {
	if rdb == nil {
		return
	}
	_ = rdb.Del(ctx, loginFailKey(email)).Err()
}
