package user

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"

	"alango/internal/auth"
	appmail "alango/internal/mail"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const (
	resetTokenTTL     = 30 * time.Minute
	resetTokenBytes   = 32
	resetCooldown     = 60 * time.Second
	maxResetPerEmail  = 5
	resetEmailWindow  = time.Hour
)

var (
	ErrResetTokenInvalid = errors.New("invalid or expired reset link")
	ErrResetTooSoon      = errors.New("password reset email was just sent, please wait")
	ErrResetSendLimitHit = errors.New("too many password reset emails requested for this address")
)

func resetTokenKey(hash string) string     { return "pwreset:tok:" + hash }
func resetUserKey(userID uint) string      { return "pwreset:usr:" + strconv.FormatUint(uint64(userID), 10) }
func resetCooldownKey(email string) string { return "pwreset:cooldown:" + strings.ToLower(email) }
func resetSendCountKey(email string) string { return "pwreset:sends:" + strings.ToLower(email) }

func generateResetToken() (string, error) {
	b := make([]byte, resetTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func checkResetSendAllowed(ctx context.Context, rdb *redis.Client, email string) error {
	if rdb == nil {
		return nil
	}
	if exists, err := rdb.Exists(ctx, resetCooldownKey(email)).Result(); err == nil && exists > 0 {
		return ErrResetTooSoon
	}
	if sends, err := rdb.Get(ctx, resetSendCountKey(email)).Int(); err == nil && sends >= maxResetPerEmail {
		return ErrResetSendLimitHit
	}
	return nil
}

func recordResetSend(ctx context.Context, rdb *redis.Client, email string) {
	if rdb == nil {
		return
	}
	_ = rdb.Set(ctx, resetCooldownKey(email), "1", resetCooldown).Err()

	cntKey := resetSendCountKey(email)
	if n, err := rdb.Incr(ctx, cntKey).Result(); err == nil && n == 1 {
		_ = rdb.Expire(ctx, cntKey, resetEmailWindow).Err()
	}
}

func sendPasswordResetEmail(sender *appmail.Sender, siteURL, email, fullName, token string) error {
	link := strings.TrimRight(siteURL, "/") + "/reset-password?token=" + url.QueryEscape(token)
	subject := "Сброс пароля"
	return sender.SendTemplate([]string{email}, subject, appmail.TemplateData{
		Title:      subject,
		Name:       fullName,
		Message:    "Мы получили запрос на сброс пароля для вашего аккаунта. Нажмите на кнопку ниже, чтобы задать новый пароль. Ссылка действительна 30 минут.\nЕсли вы не запрашивали сброс пароля, просто проигнорируйте это письмо.",
		ButtonURL:  link,
		ButtonText: "Сбросить пароль",
	})
}

func (h *UserHandler) StartPasswordReset(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))

	if err := checkResetSendAllowed(ctx, h.Redis, email); err != nil {
		return err
	}

	user, err := h.Service.GetUserByEmail(email)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		recordResetSend(ctx, h.Redis, email)
		return nil
	}
	if err != nil {
		return err
	}
	if !user.Active {
		recordResetSend(ctx, h.Redis, email)
		return nil
	}

	token, err := generateResetToken()
	if err != nil {
		return err
	}
	hash := hashResetToken(token)
	usrKey := resetUserKey(user.ID)

	if prevHash, err := h.Redis.Get(ctx, usrKey).Result(); err == nil && prevHash != "" {
		_ = h.Redis.Del(ctx, resetTokenKey(prevHash)).Err()
	}

	uidStr := strconv.FormatUint(uint64(user.ID), 10)
	if err := h.Redis.Set(ctx, resetTokenKey(hash), uidStr, resetTokenTTL).Err(); err != nil {
		return err
	}
	_ = h.Redis.Set(ctx, usrKey, hash, resetTokenTTL).Err()

	if err := sendPasswordResetEmail(h.MailSender, h.SiteURL, user.Email, user.FullName, token); err != nil {
		_ = h.Redis.Del(ctx, resetTokenKey(hash), usrKey).Err()
		return err
	}

	recordResetSend(ctx, h.Redis, email)
	return nil
}

func (h *UserHandler) ConfirmPasswordReset(ctx context.Context, token, newPassword string) (uint, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return 0, ErrResetTokenInvalid
	}

	if err := validatePasswordStrength(newPassword); err != nil {
		return 0, err
	}

	hash := hashResetToken(token)
	tokKey := resetTokenKey(hash)

	uidStr, err := h.Redis.GetDel(ctx, tokKey).Result()
	if errors.Is(err, redis.Nil) {
		return 0, ErrResetTokenInvalid
	}
	if err != nil {
		return 0, err
	}

	uid64, err := strconv.ParseUint(uidStr, 10, 64)
	if err != nil || uid64 == 0 {
		return 0, ErrResetTokenInvalid
	}
	userID := uint(uid64)

	_ = h.Redis.Del(ctx, resetUserKey(userID)).Err()

	if err := h.Service.SetPassword(userID, newPassword); err != nil {
		return 0, err
	}

	_ = auth.RevokeAllRefreshFamilies(ctx, h.Redis, userID)
	if h.Hub != nil {
		h.Hub.CloseUser(userID)
	}

	var email string
	if u, err := h.Service.GetUserByID(userID); err == nil {
		email = u.Email
	}
	if email != "" {
		clearLoginFailures(ctx, h.Redis, email)
	}

	return userID, nil
}
