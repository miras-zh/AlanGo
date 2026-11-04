package cache

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// GetJSON reads a JSON-encoded value at key into dest. Returns false on a
// cache miss or any Redis/unmarshal error (logged, never fatal) so the caller
// falls through to PostgreSQL cleanly.
func GetJSON(ctx context.Context, rdb *redis.Client, key string, dest any) bool {
	if rdb == nil {
		return false
	}

	raw, err := rdb.Get(ctx, key).Bytes()
	if err != nil {
		if err != redis.Nil {
			log.Printf("cache: get %s failed: %v", key, err)
		}
		return false
	}

	if err := json.Unmarshal(raw, dest); err != nil {
		log.Printf("cache: unmarshal %s failed: %v", key, err)
		return false
	}
	return true
}

// SetJSON writes val as JSON at key with ttl. Best-effort.
func SetJSON(ctx context.Context, rdb *redis.Client, key string, val any, ttl time.Duration) {
	if rdb == nil {
		return
	}

	raw, err := json.Marshal(val)
	if err != nil {
		log.Printf("cache: marshal %s failed: %v", key, err)
		return
	}

	if err := rdb.Set(ctx, key, raw, ttl).Err(); err != nil {
		log.Printf("cache: set %s failed: %v", key, err)
	}
}

// InvalidatePattern deletes every key matching pattern using SCAN + DEL.
func InvalidatePattern(ctx context.Context, rdb *redis.Client, pattern string) {
	if rdb == nil {
		return
	}

	iter := rdb.Scan(ctx, 0, pattern, 0).Iterator()
	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		log.Printf("cache: scan %s failed: %v", pattern, err)
		return
	}
	if len(keys) == 0 {
		return
	}

	if err := rdb.Del(ctx, keys...).Err(); err != nil {
		log.Printf("cache: del %s failed: %v", pattern, err)
	}
}
