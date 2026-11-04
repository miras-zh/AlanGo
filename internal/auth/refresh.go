package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// RefreshTokenTTL is a sliding 30-day window — each RotateRefreshToken call
// resets the family's TTL back to 30 days.
const RefreshTokenTTL = 30 * 24 * time.Hour

const (
	refreshTokenPrefix  = "reftok:"
	refreshFamilyPrefix = "reffam:"
	refreshUserPrefix   = "refuser:"
)

var ErrInvalidRefreshToken = errors.New("invalid or expired refresh token")

// ReuseDetectedError is returned by RotateRefreshToken when a token that has
// already been rotated away is presented again — the entire refresh family has
// been revoked in response.
type ReuseDetectedError struct {
	UserID uint
}

func (e *ReuseDetectedError) Error() string { return ErrInvalidRefreshToken.Error() }
func (e *ReuseDetectedError) Unwrap() error { return ErrInvalidRefreshToken }

func hashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func generateRandomHex(bytes int) (string, error) {
	b := make([]byte, bytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func IssueRefreshToken(ctx context.Context, rdb *redis.Client, userID uint) (string, error) {
	token, err := generateRandomHex(32)
	if err != nil {
		return "", err
	}
	familyID, err := generateRandomHex(16)
	if err != nil {
		return "", err
	}

	hash := hashRefreshToken(token)
	famVal := strconv.FormatUint(uint64(userID), 10) + ":" + hash
	userKey := refreshUserPrefix + strconv.FormatUint(uint64(userID), 10)

	pipe := rdb.Pipeline()
	pipe.Set(ctx, refreshFamilyPrefix+familyID, famVal, RefreshTokenTTL)
	pipe.Set(ctx, refreshTokenPrefix+hash, familyID, RefreshTokenTTL)
	pipe.SAdd(ctx, userKey, familyID)
	pipe.Expire(ctx, userKey, RefreshTokenTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return "", err
	}
	return token, nil
}

func RotateRefreshToken(ctx context.Context, rdb *redis.Client, token string) (uint, string, error) {
	if token == "" {
		return 0, "", ErrInvalidRefreshToken
	}

	hash := hashRefreshToken(token)
	familyID, err := rdb.Get(ctx, refreshTokenPrefix+hash).Result()
	if errors.Is(err, redis.Nil) {
		return 0, "", ErrInvalidRefreshToken
	}
	if err != nil {
		return 0, "", err
	}

	famKey := refreshFamilyPrefix + familyID
	famVal, err := rdb.Get(ctx, famKey).Result()
	if errors.Is(err, redis.Nil) {
		return 0, "", ErrInvalidRefreshToken
	}
	if err != nil {
		return 0, "", err
	}

	userID, currentHash, ok := parseFamilyValue(famVal)
	if !ok {
		return 0, "", ErrInvalidRefreshToken
	}

	if subtle.ConstantTimeCompare([]byte(hash), []byte(currentHash)) != 1 {
		_ = rdb.Del(ctx, famKey, refreshTokenPrefix+hash, refreshTokenPrefix+currentHash).Err()
		_ = rdb.SRem(ctx, refreshUserPrefix+strconv.FormatUint(uint64(userID), 10), familyID).Err()
		return 0, "", &ReuseDetectedError{UserID: userID}
	}

	newToken, err := generateRandomHex(32)
	if err != nil {
		return 0, "", err
	}
	newHash := hashRefreshToken(newToken)
	newFamVal := strconv.FormatUint(uint64(userID), 10) + ":" + newHash
	userKey := refreshUserPrefix + strconv.FormatUint(uint64(userID), 10)

	pipe := rdb.Pipeline()
	pipe.Set(ctx, famKey, newFamVal, RefreshTokenTTL)
	pipe.Set(ctx, refreshTokenPrefix+newHash, familyID, RefreshTokenTTL)
	pipe.Expire(ctx, userKey, RefreshTokenTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, "", err
	}

	return userID, newToken, nil
}

func RevokeRefreshToken(ctx context.Context, rdb *redis.Client, token string) error {
	if token == "" {
		return nil
	}

	hash := hashRefreshToken(token)
	familyID, err := rdb.Get(ctx, refreshTokenPrefix+hash).Result()
	if errors.Is(err, redis.Nil) {
		return nil
	}
	if err != nil {
		return err
	}

	keysToDel := []string{refreshFamilyPrefix + familyID, refreshTokenPrefix + hash}
	if famVal, err := rdb.Get(ctx, refreshFamilyPrefix+familyID).Result(); err == nil {
		if userID, currentHash, ok := parseFamilyValue(famVal); ok {
			if currentHash != hash {
				keysToDel = append(keysToDel, refreshTokenPrefix+currentHash)
			}
			_ = rdb.SRem(ctx, refreshUserPrefix+strconv.FormatUint(uint64(userID), 10), familyID).Err()
		}
	}

	return rdb.Del(ctx, keysToDel...).Err()
}

func RevokeAllRefreshFamilies(ctx context.Context, rdb *redis.Client, userID uint) error {
	userKey := refreshUserPrefix + strconv.FormatUint(uint64(userID), 10)
	familyIDs, err := rdb.SMembers(ctx, userKey).Result()
	if err != nil {
		return err
	}

	keysToDel := []string{userKey}
	for _, famID := range familyIDs {
		famKey := refreshFamilyPrefix + famID
		keysToDel = append(keysToDel, famKey)
		if famVal, err := rdb.Get(ctx, famKey).Result(); err == nil {
			if _, currentHash, ok := parseFamilyValue(famVal); ok {
				keysToDel = append(keysToDel, refreshTokenPrefix+currentHash)
			}
		}
	}

	return rdb.Del(ctx, keysToDel...).Err()
}

func parseFamilyValue(v string) (uint, string, bool) {
	uidStr, hash, ok := strings.Cut(v, ":")
	if !ok || hash == "" {
		return 0, "", false
	}
	uid, err := strconv.ParseUint(uidStr, 10, 64)
	if err != nil || uid == 0 {
		return 0, "", false
	}
	return uint(uid), hash, true
}
