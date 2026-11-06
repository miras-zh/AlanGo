package worker

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"

	"alango/internal/safego"
)

// Scheduler управляет фоновыми периодическими задачами (Cron-воркерами) приложения.
//
// Примеры задач, которые уже встроены и могут быть расширены:
// 1. cleanup_expired_tokens   — Очистка просроченных refresh-токенов и токенов сброса пароля (каждый час).
// 2. subscription_trial_check — Проверка истёкших подписок/триалов и перевод их в базовый тариф (каждый час).
// 3. retention_push_reminders — Отправка умных Push-напоминаний пользователям, которые давно не заходили (каждые 6 часов).
// 4. daily_funnel_snapshot    — Ежедневная агрегация статистики продуктовой воронки в лог/аналитику (раз в 24 часа).
type Scheduler struct {
	db *gorm.DB
}

func NewScheduler(db *gorm.DB) *Scheduler {
	return &Scheduler{db: db}
}

func (s *Scheduler) Start(ctx context.Context) {
	if strings.EqualFold(os.Getenv("ENABLE_CRON_WORKERS"), "false") {
		slog.Info("cron workers disabled via ENABLE_CRON_WORKERS=false")
		return
	}

	enabledJobs := os.Getenv("CRON_JOBS") // если пусто — включены все 4 задачи по умолчанию
	isJobEnabled := func(key string) bool {
		if enabledJobs == "" {
			return true
		}
		for _, part := range strings.Split(enabledJobs, ",") {
			if strings.TrimSpace(part) == key {
				return true
			}
		}
		return false
	}

	if isJobEnabled("cleanup_expired_tokens") {
		safego.Go(func() {
			s.runTicker(ctx, 1*time.Hour, "cleanup_expired_tokens", s.CleanupExpiredTokens)
		})
	}
	if isJobEnabled("subscription_trial_check") {
		safego.Go(func() {
			s.runTicker(ctx, 1*time.Hour, "subscription_trial_check", s.CheckExpiredSubscriptions)
		})
	}
	if isJobEnabled("retention_push_reminders") {
		safego.Go(func() {
			s.runTicker(ctx, 6*time.Hour, "retention_push_reminders", s.SendRetentionReminders)
		})
	}
	if isJobEnabled("daily_funnel_snapshot") {
		safego.Go(func() {
			s.runTicker(ctx, 24*time.Hour, "daily_funnel_snapshot", s.LogDailyFunnelSnapshot)
		})
	}
}

func (s *Scheduler) runTicker(ctx context.Context, interval time.Duration, name string, job func(context.Context) error) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := job(ctx); err != nil {
				slog.Error("cron job failed", "job", name, "error", err)
			} else {
				slog.Info("cron job completed", "job", name)
			}
		}
	}
}

// 1. Очистка истёкших refresh_tokens и password_reset_tokens
func (s *Scheduler) CleanupExpiredTokens(_ context.Context) error {
	// В AlanGo refresh-токены и временные коды хранятся в Redis с автоматическим TTL,
	// поэтому очистка на уровне PostgreSQL не требуется.
	return nil
}

// 2. Проверка истёкших подписок (автоматический перевод в тариф standard)
func (s *Scheduler) CheckExpiredSubscriptions(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	return s.db.WithContext(ctx).Exec(`
		UPDATE users
		SET plan = 'standard', updated_at = NOW()
		WHERE plan != 'standard' AND valid_until IS NOT NULL AND valid_until < NOW()
	`).Error
}

// 3. Умные Push-напоминания для удержания пользователей (Retention D1/D7)
func (s *Scheduler) SendRetentionReminders(_ context.Context) error {
	// Заготовка: здесь можно выбрать пользователей, которые зарегистрировались >24ч назад,
	// но ещё не совершили ключевое действие (first_value), и отправить им мягкое push-напоминание.
	return nil
}

// 4. Суточная сводка по ключевым событиям продуктовой воронки Case Operation
func (s *Scheduler) LogDailyFunnelSnapshot(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	var count int64
	if err := s.db.WithContext(ctx).Table("app_analytics_events").
		Where("created_at >= NOW() - INTERVAL '24 hours'").
		Count(&count).Error; err != nil {
		return err
	}
	slog.Info("daily funnel events snapshot (last 24h)", "events_count", count)
	return nil
}
