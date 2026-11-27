package sport

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"alango/internal/auth"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

var (
	ErrReminderNotFound   = errors.New("напоминание не найдено")
	ErrReminderTitleEmpty = errors.New("укажите текст напоминания")
	ErrReminderStatusBad  = errors.New("недопустимый статус напоминания")
)

type ArenaReminder struct {
	ID         uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	ArenaID    uint       `gorm:"column:arena_id;not null" json:"arena_id"`
	BookingID  *uint      `gorm:"column:booking_id" json:"booking_id,omitempty"`
	ClientID   *uint      `gorm:"column:client_id" json:"client_id,omitempty"`
	CreatedBy  *uint      `gorm:"column:created_by" json:"created_by,omitempty"`
	Title      string     `gorm:"column:title;type:varchar(200);not null" json:"title"`
	Notes      string     `gorm:"column:notes;type:text;not null;default:''" json:"notes"`
	DueDate    string     `gorm:"column:due_date;type:varchar(20);not null" json:"due_date"`
	DueTime    string     `gorm:"column:due_time;type:varchar(10);not null;default:'10:00'" json:"due_time"`
	RemindPush bool       `gorm:"column:remind_push;not null;default:true" json:"remind_push"`
	Status     string     `gorm:"column:status;type:varchar(20);not null;default:'pending'" json:"status"`
	NotifiedAt *time.Time `gorm:"column:notified_at" json:"notified_at,omitempty"`
	CreatedAt  time.Time  `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt  time.Time  `gorm:"column:updated_at;default:now()" json:"updated_at"`
}

func (ArenaReminder) TableName() string { return "arena_reminders" }

type SmartReminderItem struct {
	Kind       string `json:"kind"` // "pending_request" | "unpaid_booking" | "dormant_client"
	Title      string `json:"title"`
	Subtitle   string `json:"subtitle"`
	BookingID  *uint  `json:"booking_id,omitempty"`
	ClientID   *uint  `json:"client_id,omitempty"`
	ClientName string `json:"client_name,omitempty"`
	Phone      string `json:"phone,omitempty"`
	AmountDue  int    `json:"amount_due,omitempty"`
}

type RemindersDashboard struct {
	Smart []SmartReminderItem `json:"smart"`
	Tasks []ArenaReminder     `json:"tasks"`
}

type CreateReminderRequest struct {
	Title      string `json:"title"`
	Notes      string `json:"notes"`
	DueDate    string `json:"due_date"`
	DueTime    string `json:"due_time"`
	RemindPush *bool  `json:"remind_push"`
	BookingID  *uint  `json:"booking_id"`
	ClientID   *uint  `json:"client_id"`
}

type UpdateReminderRequest struct {
	Status     *string `json:"status"`
	Title      *string `json:"title"`
	Notes      *string `json:"notes"`
	DueDate    *string `json:"due_date"`
	DueTime    *string `json:"due_time"`
	RemindPush *bool   `json:"remind_push"`
}

func (s *Service) GetRemindersDashboard(ctx context.Context, arenaID uint) (*RemindersDashboard, error) {
	now := time.Now().In(venueTZ)
	today := now.Format("2006-01-02")
	cutoffDormant := now.AddDate(0, 0, -30).Format("2006-01-02")

	smart := []SmartReminderItem{}

	// 1. Pending booking requests waiting for answer
	var pending []Booking
	if err := s.db.WithContext(ctx).Table("bookings").
		Select("bookings.*, halls.title as hall_title").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Where("bookings.arena_id = ? AND bookings.status = 'pending' AND bookings.booking_date >= ?", arenaID, today).
		Order("bookings.booking_date ASC, bookings.start_time ASC").
		Limit(10).
		Find(&pending).Error; err == nil {
		for _, b := range pending {
			id := b.ID
			smart = append(smart, SmartReminderItem{
				Kind:       "pending_request",
				Title:      fmt.Sprintf("Заявка: %s (%s)", b.ClientName, b.HallTitle),
				Subtitle:   fmt.Sprintf("%s · %s — ждёт подтверждения", ruDate(b.BookingDate), b.TimeSlot),
				BookingID:  &id,
				ClientName: b.ClientName,
				Phone:      b.ClientPhone,
			})
		}
	}

	// 2. Confirmed bookings today/tomorrow with unpaid balance
	tomorrow := now.AddDate(0, 0, 1).Format("2006-01-02")
	var unpaid []Booking
	if err := s.db.WithContext(ctx).Table("bookings").
		Select("bookings.*, halls.title as hall_title").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Where("bookings.arena_id = ? AND bookings.status = 'confirmed' AND bookings.booking_date >= ? AND bookings.booking_date <= ? AND bookings.paid_amount < bookings.total_price", arenaID, today, tomorrow).
		Order("bookings.booking_date ASC, bookings.start_time ASC").
		Limit(15).
		Find(&unpaid).Error; err == nil {
		for _, b := range unpaid {
			due := b.TotalPrice - b.PaidAmount
			if due <= 0 {
				continue
			}
			id := b.ID
			smart = append(smart, SmartReminderItem{
				Kind:       "unpaid_booking",
				Title:      fmt.Sprintf("Доплата: %s (%s)", b.ClientName, b.HallTitle),
				Subtitle:   fmt.Sprintf("%s · %s — остаток %d ₸", ruDate(b.BookingDate), b.TimeSlot, due),
				BookingID:  &id,
				ClientName: b.ClientName,
				Phone:      b.ClientPhone,
				AmountDue:  due,
			})
		}
	}

	// 3. Regular clients with no visit in the last 30 days
	type dormantRow struct {
		ID       uint   `gorm:"column:id"`
		Name     string `gorm:"column:name"`
		Phone    string `gorm:"column:phone"`
		LastDate string `gorm:"column:last_date"`
		Total    int    `gorm:"column:total"`
	}
	var dormant []dormantRow
	if err := s.db.WithContext(ctx).Raw(`
		SELECT
			ac.id,
			COALESCE(NULLIF(ac.display_name, ''), NULLIF(u.full_name, ''), 'Клиент') AS name,
			COALESCE(NULLIF(ac.display_phone, ''), NULLIF(u.phone, ''), '') AS phone,
			MAX(b.booking_date) AS last_date,
			COUNT(b.id) AS total
		FROM arena_clients ac
		LEFT JOIN users u ON u.id = ac.user_id
		JOIN bookings b ON b.arena_id = ac.arena_id AND (
			(ac.user_id IS NOT NULL AND b.user_id = ac.user_id) OR
			(LENGTH(RIGHT(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g'), 10)) = 10
			 AND RIGHT(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g'), 10) = ac.phone_key)
		)
		WHERE ac.arena_id = ? AND ac.segment_override <> 'blocked' AND b.status IN ('confirmed', 'completed')
		GROUP BY ac.id, ac.display_name, ac.display_phone, u.full_name, u.phone
		HAVING COUNT(b.id) >= 2 AND MAX(b.booking_date) < ?
		ORDER BY MAX(b.booking_date) DESC
		LIMIT 10
	`, arenaID, cutoffDormant).Scan(&dormant).Error; err == nil {
		for _, d := range dormant {
			cid := d.ID
			smart = append(smart, SmartReminderItem{
				Kind:       "dormant_client",
				Title:      fmt.Sprintf("Вернуть клиента: %s", d.Name),
				Subtitle:   fmt.Sprintf("Последний визит %s (%d броней)", ruDate(d.LastDate), d.Total),
				ClientID:   &cid,
				ClientName: d.Name,
				Phone:      d.Phone,
			})
		}
	}

	var tasks []ArenaReminder
	if err := s.db.WithContext(ctx).
		Where("arena_id = ?", arenaID).
		Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END ASC, due_date ASC, due_time ASC, id DESC").
		Limit(100).
		Find(&tasks).Error; err != nil {
		return nil, err
	}

	return &RemindersDashboard{Smart: smart, Tasks: tasks}, nil
}

func (s *Service) CreateReminder(ctx context.Context, arenaID, userID uint, req CreateReminderRequest) (*ArenaReminder, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, ErrReminderTitleEmpty
	}
	if utf8.RuneCountInString(title) > 200 {
		title = string([]rune(title)[:200])
	}
	dueDate := strings.TrimSpace(req.DueDate)
	if dueDate == "" {
		dueDate = time.Now().In(venueTZ).Format("2006-01-02")
	}
	day, err := parseDate(dueDate)
	if err != nil {
		return nil, err
	}
	dueTime := strings.TrimSpace(req.DueTime)
	if dueTime == "" {
		dueTime = "10:00"
	}
	mins, err := parseClock(dueTime)
	if err != nil {
		return nil, err
	}
	notes := strings.TrimSpace(req.Notes)
	if utf8.RuneCountInString(notes) > 1000 {
		notes = string([]rune(notes)[:1000])
	}
	remindPush := true
	if req.RemindPush != nil {
		remindPush = *req.RemindPush
	}
	uid := userID
	now := time.Now()
	rem := ArenaReminder{
		ArenaID:    arenaID,
		BookingID:  req.BookingID,
		ClientID:   req.ClientID,
		CreatedBy:  &uid,
		Title:      title,
		Notes:      notes,
		DueDate:    day.Format("2006-01-02"),
		DueTime:    formatClock(mins),
		RemindPush: remindPush,
		Status:     "pending",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.db.WithContext(ctx).Create(&rem).Error; err != nil {
		return nil, err
	}
	return &rem, nil
}

func (s *Service) UpdateReminder(ctx context.Context, arenaID, reminderID uint, req UpdateReminderRequest) (*ArenaReminder, error) {
	var rem ArenaReminder
	if err := s.db.WithContext(ctx).Where("id = ? AND arena_id = ?", reminderID, arenaID).Take(&rem).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReminderNotFound
		}
		return nil, err
	}
	updates := map[string]any{"updated_at": time.Now()}
	if req.Status != nil {
		st := strings.TrimSpace(*req.Status)
		if st != "pending" && st != "done" {
			return nil, ErrReminderStatusBad
		}
		updates["status"] = st
	}
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, ErrReminderTitleEmpty
		}
		if utf8.RuneCountInString(title) > 200 {
			title = string([]rune(title)[:200])
		}
		updates["title"] = title
	}
	if req.Notes != nil {
		updates["notes"] = strings.TrimSpace(*req.Notes)
	}
	if req.DueDate != nil {
		day, err := parseDate(*req.DueDate)
		if err != nil {
			return nil, err
		}
		updates["due_date"] = day.Format("2006-01-02")
		updates["notified_at"] = nil
	}
	if req.DueTime != nil {
		mins, err := parseClock(*req.DueTime)
		if err != nil {
			return nil, err
		}
		updates["due_time"] = formatClock(mins)
		updates["notified_at"] = nil
	}
	if req.RemindPush != nil {
		updates["remind_push"] = *req.RemindPush
	}
	if err := s.db.WithContext(ctx).Model(&ArenaReminder{}).Where("id = ? AND arena_id = ?", reminderID, arenaID).Updates(updates).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Where("id = ? AND arena_id = ?", reminderID, arenaID).Take(&rem).Error; err != nil {
		return nil, err
	}
	return &rem, nil
}

func (s *Service) DeleteReminder(ctx context.Context, arenaID, reminderID uint) error {
	res := s.db.WithContext(ctx).Where("id = ? AND arena_id = ?", reminderID, arenaID).Delete(&ArenaReminder{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrReminderNotFound
	}
	return nil
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

func (h *Handler) ListOwnReminders(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrNoOwnArena) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(RemindersDashboard{Smart: []SmartReminderItem{}, Tasks: []ArenaReminder{}})
			return
		}
		http.Error(w, `{"error":"failed to resolve arena"}`, http.StatusInternalServerError)
		return
	}
	dash, err := h.service.GetRemindersDashboard(r.Context(), arenaID)
	if err != nil {
		http.Error(w, `{"error":"failed to load reminders"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dash)
}

func (h *Handler) CreateOwnReminder(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return
	}
	var req CreateReminderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	rem, err := h.service.CreateReminder(r.Context(), arenaID, userID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{"reminder": rem})
}

func (h *Handler) UpdateOwnReminder(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return
	}
	remID, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid reminder id"}`, http.StatusBadRequest)
		return
	}
	var req UpdateReminderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	rem, err := h.service.UpdateReminder(r.Context(), arenaID, uint(remID), req)
	if err != nil {
		if errors.Is(err, ErrReminderNotFound) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"reminder": rem})
}

func (h *Handler) DeleteOwnReminder(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return
	}
	remID, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid reminder id"}`, http.StatusBadRequest)
		return
	}
	if err := h.service.DeleteReminder(r.Context(), arenaID, uint(remID)); err != nil {
		if errors.Is(err, ErrReminderNotFound) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to delete reminder"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
