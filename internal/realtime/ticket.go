package realtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const ticketTTL = 30 * time.Second

var ErrInvalidTicket = errors.New("invalid or expired ticket")

func ticketKey(token string) string {
	return "realtime_ticket:" + token
}

func generateTicket() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func MintTicket(ctx context.Context, rdb *redis.Client, userID uint) (string, error) {
	token, err := generateTicket()
	if err != nil {
		return "", err
	}
	if err := rdb.Set(ctx, ticketKey(token), strconv.FormatUint(uint64(userID), 10), ticketTTL).Err(); err != nil {
		return "", err
	}
	return token, nil
}

func ConsumeTicket(ctx context.Context, rdb *redis.Client, token string) (uint, error) {
	raw, err := rdb.GetDel(ctx, ticketKey(token)).Result()
	if errors.Is(err, redis.Nil) {
		return 0, ErrInvalidTicket
	}
	if err != nil {
		return 0, err
	}

	userID, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, ErrInvalidTicket
	}

	return uint(userID), nil
}
