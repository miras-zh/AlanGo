package user

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	loginFailPrefix = "login_fail:"
	maxLoginFails   = 5
	loginFailWindow = 15 * time.Minute
	maxMemGuardKeys = 50000
)

type memGuardEntry struct {
	count     int
	expiresAt time.Time
}

type memGuardStore struct {
	mu      sync.Mutex
	entries map[string]memGuardEntry
}

var authGuardMem = &memGuardStore{
	entries: make(map[string]memGuardEntry),
}

func (m *memGuardStore) pruneLocked(now time.Time) {
	if len(m.entries) < maxMemGuardKeys {
		return
	}
	for k, v := range m.entries {
		if !now.Before(v.expiresAt) {
			delete(m.entries, k)
		}
	}
	if len(m.entries) >= maxMemGuardKeys {
		for k := range m.entries {
			delete(m.entries, k)
			break
		}
	}
}

func (m *memGuardStore) exists(key string) bool {
	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.entries[key]
	if !ok {
		return false
	}
	if !now.Before(v.expiresAt) {
		delete(m.entries, key)
		return false
	}
	return true
}

func (m *memGuardStore) getCount(key string) int {
	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.entries[key]
	if !ok {
		return 0
	}
	if !now.Before(v.expiresAt) {
		delete(m.entries, key)
		return 0
	}
	return v.count
}

func (m *memGuardStore) setFlag(key string, ttl time.Duration) {
	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneLocked(now)
	m.entries[key] = memGuardEntry{count: 1, expiresAt: now.Add(ttl)}
}

func (m *memGuardStore) incr(key string, ttl time.Duration) int {
	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneLocked(now)
	v, ok := m.entries[key]
	if !ok || !now.Before(v.expiresAt) {
		v = memGuardEntry{count: 1, expiresAt: now.Add(ttl)}
	} else {
		v.count++
	}
	m.entries[key] = v
	return v.count
}

func (m *memGuardStore) del(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.entries, key)
}

func loginFailKey(email string) string {
	return loginFailPrefix + strings.ToLower(strings.TrimSpace(email))
}

func isLoginLocked(ctx context.Context, rdb *redis.Client, email string) bool {
	key := loginFailKey(email)
	if rdb != nil {
		n, err := rdb.Get(ctx, key).Int()
		if err == nil {
			return n >= maxLoginFails
		}
		if errors.Is(err, redis.Nil) {
			return authGuardMem.getCount(key) >= maxLoginFails
		}
	}
	return authGuardMem.getCount(key) >= maxLoginFails
}

func recordLoginFailure(ctx context.Context, rdb *redis.Client, email string) {
	key := loginFailKey(email)
	if rdb != nil {
		n, err := rdb.Incr(ctx, key).Result()
		if err == nil {
			if n == 1 {
				_ = rdb.Expire(ctx, key, loginFailWindow).Err()
			}
			return
		}
	}
	authGuardMem.incr(key, loginFailWindow)
}

func clearLoginFailures(ctx context.Context, rdb *redis.Client, email string) {
	key := loginFailKey(email)
	authGuardMem.del(key)
	if rdb == nil {
		return
	}
	_ = rdb.Del(ctx, key).Err()
}
