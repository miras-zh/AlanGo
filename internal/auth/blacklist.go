package auth

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

const blacklistPrefix = "jwt:blacklist:"

func Blacklist(ctx context.Context, rdb *redis.Client, jti string, ttl time.Duration) error {
	if ttl <= 0 {
		return nil
	}
	return rdb.Set(ctx, blacklistPrefix+jti, "1", ttl).Err()
}

func IsBlacklisted(ctx context.Context, rdb *redis.Client, jti string) (bool, error) {
	n, err := rdb.Exists(ctx, blacklistPrefix+jti).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}
