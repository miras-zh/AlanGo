package worker

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"

	"alango/internal/safego"
)

var kzLocation = time.FixedZone("KZ", 5*60*60)

// Notifier creates persisted in-app + realtime + push notifications.
type Notifier interface {
	Create(userID uint, actorID *uint, notifType, title, body string, entityID *uint, broadcast bool) error
}

// Scheduler управляет фоновыми периодическими задачами (Cron-воркерами) приложения.
type Scheduler struct {
	db       *gorm.DB
	notifier Notifier
}

func NewScheduler(db *gorm.DB) *Scheduler {
	return &Scheduler{db: db}
}

func (s *Scheduler) SetNotifier(n Notifier) {
	if s != nil {
		s.notifier = n
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	if strings.EqualFold(os.Getenv("ENABLE_CRON_WORKERS"), "false") {
		slog.Info("cron workers disabled via ENABLE_CRON_WORKERS=false")
		return
	}

	enabledJobs := os.Getenv("CRON_JOBS")
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
	if isJobEnabled("upcoming_booking_reminders") {
		safego.Go(func() {
			s.runTicker(ctx, 10*time.Minute, "upcoming_booking_reminders", s.SendUpcomingBookingReminders)
		})
	}
	if isJobEnabled("due_business_reminders") {
		safego.Go(func() {
			s.runTicker(ctx, 5*time.Minute, "due_business_reminders", s.SendDueBusinessReminders)
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
	if isJobEnabled("cleanup_old_records") {
		safego.Go(func() {
			s.runTicker(ctx, 24*time.Hour, "cleanup_old_records", s.CleanupOldRecords)
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
	return nil
}

// 2. Проверка истёкших подписок (автоматический перевод в тариф standard)
func (s *Scheduler) CheckExpiredSubscriptions(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	return s.db.WithContext(ctx).Exec(`
		UPDATE users
		SET plan = 'standard', plan_expires_at = NULL
		WHERE plan <> 'standard' AND plan_expires_at IS NOT NULL AND plan_expires_at < NOW()
	`).Error
}

// 3. Автоматические Push + In-App напоминания клиентам за <= 2 часа до игры
func (s *Scheduler) SendUpcomingBookingReminders(ctx context.Context) error {
	if s.db == nil || s.notifier == nil {
		return nil
	}
	now := time.Now().In(kzLocation)
	today := now.Format("2006-01-02")
	tomorrow := now.AddDate(0, 0, 1).Format("2006-01-02")

	type upcomingRow struct {
		ID          uint   `gorm:"column:id"`
		UserID      uint   `gorm:"column:user_id"`
		BookingDate string `gorm:"column:booking_date"`
		StartTime   string `gorm:"column:start_time"`
		TimeSlot    string `gorm:"column:time_slot"`
		ArenaTitle  string `gorm:"column:arena_title"`
		HallTitle   string `gorm:"column:hall_title"`
	}
	var rows []upcomingRow
	if err := s.db.WithContext(ctx).Raw(`
		SELECT
			b.id,
			b.user_id,
			b.booking_date,
			b.start_time,
			b.time_slot,
			a.title AS arena_title,
			h.title AS hall_title
		FROM bookings b
		JOIN arenas a ON a.id = b.arena_id
		JOIN halls h ON h.id = b.hall_id
		WHERE b.status = 'confirmed'
		  AND b.user_id IS NOT NULL
		  AND b.reminder_sent_at IS NULL
		  AND b.booking_date IN (?, ?)
	`, today, tomorrow).Scan(&rows).Error; err != nil {
		return err
	}

	for _, r := range rows {
		startAt, err := time.ParseInLocation("2006-01-02 15:04", r.BookingDate+" "+r.StartTime, kzLocation)
		if err != nil {
			continue
		}
		diff := startAt.Sub(now)
		if diff <= 0 || diff > 2*time.Hour {
			continue
		}

		res := s.db.WithContext(ctx).Exec(`
			UPDATE bookings
			SET reminder_sent_at = NOW()
			WHERE id = ? AND reminder_sent_at IS NULL
		`, r.ID)
		if res.Error != nil || res.RowsAffected == 0 {
			continue
		}

		mins := int(diff.Minutes())
		when := fmt.Sprintf("через %d мин", mins)
		if mins >= 60 {
			when = fmt.Sprintf("через %d ч %d мин", mins/60, mins%60)
		}
		bid := r.ID
		_ = s.notifier.Create(
			r.UserID,
			nil,
			"upcoming_game",
			"Напоминание об игре ⚽️",
			fmt.Sprintf("%s (%s) — начало %s, слот %s", r.ArenaTitle, r.HallTitle, when, r.TimeSlot),
			&bid,
			true,
		)
	}
	return nil
}

// 4. Push-напоминания владельцу бизнеса по наступившим задачам из arena_reminders
func (s *Scheduler) SendDueBusinessReminders(ctx context.Context) error {
	if s.db == nil || s.notifier == nil {
		return nil
	}
	now := time.Now().In(kzLocation)
	today := now.Format("2006-01-02")
	nowClock := now.Format("15:04")

	type dueRow struct {
		ID      uint   `gorm:"column:id"`
		ArenaID uint   `gorm:"column:arena_id"`
		OwnerID uint   `gorm:"column:owner_id"`
		Title   string `gorm:"column:title"`
		Notes   string `gorm:"column:notes"`
		DueTime string `gorm:"column:due_time"`
	}
	var rows []dueRow
	if err := s.db.WithContext(ctx).Raw(`
		SELECT ar.id, ar.arena_id, a.owner_id, ar.title, ar.notes, ar.due_time
		FROM arena_reminders ar
		JOIN arenas a ON a.id = ar.arena_id
		WHERE ar.status = 'pending'
		  AND ar.remind_push = true
		  AND ar.notified_at IS NULL
		  AND a.owner_id IS NOT NULL
		  AND (ar.due_date < ? OR (ar.due_date = ? AND ar.due_time <= ?))
		LIMIT 100
	`, today, today, nowClock).Scan(&rows).Error; err != nil {
		return err
	}

	for _, r := range rows {
		res := s.db.WithContext(ctx).Exec(`
			UPDATE arena_reminders
			SET notified_at = NOW()
			WHERE id = ? AND notified_at IS NULL
		`, r.ID)
		if res.Error != nil || res.RowsAffected == 0 {
			continue
		}
		body := r.Notes
		if body == "" {
			body = fmt.Sprintf("Запланировано на %s", r.DueTime)
		}
		aid := r.ArenaID
		_ = s.notifier.Create(
			r.OwnerID,
			nil,
			"business_reminder",
			"Напоминание: "+r.Title,
			body,
			&aid,
			true,
		)
	}
	return nil
}

// 5. Умные Push-напоминания для удержания пользователей (Retention D1)
func (s *Scheduler) SendRetentionReminders(ctx context.Context) error {
	if s.db == nil || s.notifier == nil {
		return nil
	}
	var userIDs []uint
	if err := s.db.WithContext(ctx).Raw(`
		SELECT u.id
		FROM users u
		WHERE u.active = true
		  AND u.role = 'client'
		  AND u.marketing_push_enabled = true
		  AND COALESCE(u.push_token, '') <> ''
		  AND u.created_at < NOW() - INTERVAL '24 hours'
		  AND u.created_at > NOW() - INTERVAL '14 days'
		  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = u.id)
		  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.type = 'retention_reminder')
		ORDER BY u.id ASC
		LIMIT 100
	`).Scan(&userIDs).Error; err != nil {
		return err
	}

	for _, uid := range userIDs {
		_ = s.notifier.Create(
			uid,
			nil,
			"retention_reminder",
			"Сыграем на этой неделе? ⚽️",
			"Выберите ближайший зал и забронируйте удобный слот в пару касаний.",
			nil,
			true,
		)
	}
	return nil
}

// 6. Суточная сводка по ключевым событиям продуктовой воронки Case Operation
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

// 7. Периодическая очистка устаревших аналитических событий и прочитанных уведомлений
func (s *Scheduler) CleanupOldRecords(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	if err := s.db.WithContext(ctx).Exec(`
		DELETE FROM app_analytics_events
		WHERE created_at < NOW() - INTERVAL '90 days'
	`).Error; err != nil {
		return err
	}
	return s.db.WithContext(ctx).Exec(`
		DELETE FROM notifications
		WHERE read = true AND created_at < NOW() - INTERVAL '180 days'
	`).Error
}
