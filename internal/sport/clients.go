package sport

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"alango/internal/auth"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrClientNotFound    = errors.New("клиент не найден")
	ErrInvalidSegment    = errors.New("недопустимый сегмент клиента")
	ErrClientNoteTooLong = errors.New("заметка не должна превышать 2000 символов")
)

type ArenaClient struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ArenaID         uint      `gorm:"column:arena_id;not null" json:"arena_id"`
	UserID          *uint     `gorm:"column:user_id" json:"user_id,omitempty"`
	PhoneKey        string    `gorm:"column:phone_key;type:varchar(64);not null" json:"phone_key"`
	DisplayName     string    `gorm:"column:display_name;type:varchar(120);not null;default:''" json:"display_name"`
	DisplayPhone    string    `gorm:"column:display_phone;type:varchar(50);not null;default:''" json:"display_phone"`
	SegmentOverride string    `gorm:"column:segment_override;type:varchar(20);not null;default:''" json:"segment_override"`
	Tags            string    `gorm:"column:tags;type:text;not null;default:''" json:"tags"`
	Notes           string    `gorm:"column:notes;type:text;not null;default:''" json:"notes"`
	CreatedAt       time.Time `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at;default:now()" json:"updated_at"`
}

func (ArenaClient) TableName() string { return "arena_clients" }

type ArenaClientView struct {
	ID                uint    `json:"id"`
	ArenaID           uint    `json:"arena_id"`
	UserID            *uint   `json:"user_id,omitempty"`
	Name              string  `json:"name"`
	Phone             string  `json:"phone"`
	AvatarURL         string  `json:"avatar_url,omitempty"`
	HasApp            bool    `json:"has_app"`
	HasPush           bool    `json:"has_push"`
	TotalBookings     int     `json:"total_bookings"`
	ConfirmedBookings int     `json:"confirmed_bookings"`
	CancelledBookings int     `json:"cancelled_bookings"`
	TotalSpent        int     `json:"total_spent"`
	PaidAmount        int     `json:"paid_amount"`
	UnpaidAmount      int     `json:"unpaid_amount"`
	LastBookingDate   string  `json:"last_booking_date"`
	SportPreferred    string  `json:"sport_preferred"`
	Rating            float64 `json:"rating"`
	RatingsCount      int     `json:"ratings_count"`
	Segment           string  `json:"segment"`
	SegmentOverride   string  `json:"segment_override"`
	Tags              string  `json:"tags"`
	Notes             string  `json:"notes"`
}

type CreateArenaClientRequest struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Segment string `json:"segment"`
	Tags    string `json:"tags"`
	Notes   string `json:"notes"`
}

type UpdateArenaClientRequest struct {
	Name    *string `json:"name"`
	Phone   *string `json:"phone"`
	Segment *string `json:"segment"`
	Tags    *string `json:"tags"`
	Notes   *string `json:"notes"`
}

func resolveUserByPhoneKey(db *gorm.DB, phoneKey string) *uint {
	if len(phoneKey) != 10 {
		return nil
	}
	var uid uint
	err := db.Table("users").
		Select("id").
		Where("LENGTH(RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10)) = 10 AND RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ?", phoneKey).
		Order("id ASC").
		Take(&uid).Error
	if err != nil || uid == 0 {
		return nil
	}
	return &uid
}

// upsertArenaClientTx links the booking's client to arena_clients inside the
// booking transaction, auto-matching any registered user with the same phone
// so records stay normalized without duplication.
func upsertArenaClientTx(tx *gorm.DB, arenaID uint, userID *uint, name, phone, phoneKey string) {
	if arenaID == 0 || phoneKey == "" {
		return
	}
	resolvedUID := userID
	if resolvedUID == nil {
		resolvedUID = resolveUserByPhoneKey(tx, phoneKey)
	}
	now := time.Now()
	row := ArenaClient{
		ArenaID:      arenaID,
		UserID:       resolvedUID,
		PhoneKey:     phoneKey,
		DisplayName:  strings.TrimSpace(name),
		DisplayPhone: strings.TrimSpace(phone),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	_ = tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "arena_id"}, {Name: "phone_key"}},
		DoUpdates: clause.Assignments(map[string]any{
			"user_id":       gorm.Expr("COALESCE(arena_clients.user_id, EXCLUDED.user_id)"),
			"display_name":  gorm.Expr("CASE WHEN arena_clients.display_name = '' THEN EXCLUDED.display_name ELSE arena_clients.display_name END"),
			"display_phone": gorm.Expr("CASE WHEN arena_clients.display_phone = '' THEN EXCLUDED.display_phone ELSE arena_clients.display_phone END"),
			"updated_at":    now,
		}),
	}).Create(&row).Error
}

func deriveClientSegment(override string, totalSpent, totalBookings int) string {
	switch override {
	case "vip", "regular", "new", "blocked":
		return override
	}
	if totalSpent > 40000 || totalBookings >= 5 {
		return "vip"
	}
	if totalBookings >= 2 {
		return "regular"
	}
	return "new"
}

func (s *Service) ListArenaClients(ctx context.Context, arenaID uint) ([]ArenaClientView, error) {
	type rawRow struct {
		ID                uint     `gorm:"column:id"`
		ArenaID           uint     `gorm:"column:arena_id"`
		UserID            *uint    `gorm:"column:user_id"`
		Name              string   `gorm:"column:name"`
		Phone             string   `gorm:"column:phone"`
		AvatarURL         string   `gorm:"column:avatar_url"`
		HasApp            bool     `gorm:"column:has_app"`
		HasPush           bool     `gorm:"column:has_push"`
		SegmentOverride   string   `gorm:"column:segment_override"`
		Tags              string   `gorm:"column:tags"`
		Notes             string   `gorm:"column:notes"`
		TotalBookings     int      `gorm:"column:total_bookings"`
		ConfirmedBookings int      `gorm:"column:confirmed_bookings"`
		CancelledBookings int      `gorm:"column:cancelled_bookings"`
		TotalSpent        int      `gorm:"column:total_spent"`
		PaidAmount        int      `gorm:"column:paid_amount"`
		LastBookingDate   string   `gorm:"column:last_booking_date"`
		SportPreferred    string   `gorm:"column:sport_preferred"`
		AvgRating         *float64 `gorm:"column:avg_rating"`
		RatingsCount      int      `gorm:"column:ratings_count"`
	}

	var rows []rawRow
	err := s.db.WithContext(ctx).Raw(`
		SELECT
			ac.id,
			ac.arena_id,
			ac.user_id,
			COALESCE(NULLIF(ac.display_name, ''), NULLIF(u.full_name, ''), NULLIF(MAX(b.client_name), ''), 'Клиент') AS name,
			COALESCE(NULLIF(ac.display_phone, ''), NULLIF(u.phone, ''), NULLIF(MAX(b.client_phone), ''), '') AS phone,
			COALESCE(u.photo, '') AS avatar_url,
			(u.id IS NOT NULL) AS has_app,
			(u.id IS NOT NULL AND COALESCE(u.push_token, '') <> '' AND COALESCE(u.marketing_push_enabled, true) = true) AS has_push,
			ac.segment_override,
			ac.tags,
			ac.notes,
			COUNT(DISTINCT b.id) AS total_bookings,
			COUNT(DISTINCT CASE WHEN b.status IN ('confirmed', 'completed') THEN b.id END) AS confirmed_bookings,
			COUNT(DISTINCT CASE WHEN b.status IN ('cancelled', 'rejected') THEN b.id END) AS cancelled_bookings,
			COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price ELSE 0 END), 0) AS total_spent,
			COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.paid_amount ELSE 0 END), 0) AS paid_amount,
			COALESCE(MAX(b.booking_date), '') AS last_booking_date,
			COALESCE(MAX(h.sport_type), 'football') AS sport_preferred,
			AVG(cr.score) AS avg_rating,
			COUNT(DISTINCT cr.id) AS ratings_count
		FROM arena_clients ac
		LEFT JOIN users u ON u.id = ac.user_id
		LEFT JOIN bookings b ON b.arena_id = ac.arena_id AND (
			(ac.user_id IS NOT NULL AND b.user_id = ac.user_id) OR
			(LENGTH(RIGHT(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g'), 10)) = 10
			 AND RIGHT(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g'), 10) = ac.phone_key) OR
			(ac.phone_key LIKE 'raw:%' AND ac.phone_key = 'raw:' || LOWER(TRIM(b.client_name)))
		)
		LEFT JOIN halls h ON h.id = b.hall_id
		LEFT JOIN client_ratings cr ON cr.booking_id = b.id
		WHERE ac.arena_id = ?
		GROUP BY ac.id, ac.arena_id, ac.user_id, ac.display_name, ac.display_phone, ac.segment_override, ac.tags, ac.notes, u.id, u.full_name, u.phone, u.photo, u.push_token, u.marketing_push_enabled
		ORDER BY total_spent DESC, last_booking_date DESC, ac.id DESC
	`, arenaID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	out := make([]ArenaClientView, 0, len(rows))
	for _, r := range rows {
		rating := DefaultClientRating
		if r.RatingsCount > 0 && r.AvgRating != nil {
			rating = math.Round(*r.AvgRating*10) / 10
		}
		unpaid := r.TotalSpent - r.PaidAmount
		if unpaid < 0 {
			unpaid = 0
		}
		out = append(out, ArenaClientView{
			ID:                r.ID,
			ArenaID:           r.ArenaID,
			UserID:            r.UserID,
			Name:              r.Name,
			Phone:             r.Phone,
			AvatarURL:         r.AvatarURL,
			HasApp:            r.HasApp,
			HasPush:           r.HasPush,
			TotalBookings:     r.TotalBookings,
			ConfirmedBookings: r.ConfirmedBookings,
			CancelledBookings: r.CancelledBookings,
			TotalSpent:        r.TotalSpent,
			PaidAmount:        r.PaidAmount,
			UnpaidAmount:      unpaid,
			LastBookingDate:   r.LastBookingDate,
			SportPreferred:    r.SportPreferred,
			Rating:            rating,
			RatingsCount:      r.RatingsCount,
			Segment:           deriveClientSegment(r.SegmentOverride, r.TotalSpent, r.TotalBookings),
			SegmentOverride:   r.SegmentOverride,
			Tags:              r.Tags,
			Notes:             r.Notes,
		})
	}
	return out, nil
}

func (s *Service) CreateArenaClient(ctx context.Context, arenaID uint, req CreateArenaClientRequest) (*ArenaClientView, error) {
	name, err := validateClientName(req.Name)
	if err != nil {
		return nil, err
	}
	phone, phoneKey, err := validateClientPhone(req.Phone)
	if err != nil {
		return nil, err
	}
	seg := strings.TrimSpace(req.Segment)
	switch seg {
	case "", "vip", "regular", "new", "blocked":
	default:
		return nil, ErrInvalidSegment
	}
	notes := strings.TrimSpace(req.Notes)
	if utf8.RuneCountInString(notes) > 2000 {
		return nil, ErrClientNoteTooLong
	}
	tags := strings.TrimSpace(req.Tags)

	uid := resolveUserByPhoneKey(s.db.WithContext(ctx), phoneKey)
	now := time.Now()
	row := ArenaClient{
		ArenaID:         arenaID,
		UserID:          uid,
		PhoneKey:        phoneKey,
		DisplayName:     name,
		DisplayPhone:    phone,
		SegmentOverride: seg,
		Tags:            tags,
		Notes:           notes,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "arena_id"}, {Name: "phone_key"}},
		DoUpdates: clause.Assignments(map[string]any{
			"user_id":          gorm.Expr("COALESCE(arena_clients.user_id, EXCLUDED.user_id)"),
			"display_name":     name,
			"display_phone":    phone,
			"segment_override": gorm.Expr("CASE WHEN ? <> '' THEN ? ELSE arena_clients.segment_override END", seg, seg),
			"tags":             gorm.Expr("CASE WHEN ? <> '' THEN ? ELSE arena_clients.tags END", tags, tags),
			"notes":            gorm.Expr("CASE WHEN ? <> '' THEN ? ELSE arena_clients.notes END", notes, notes),
			"updated_at":       now,
		}),
	}).Create(&row).Error; err != nil {
		return nil, err
	}

	all, err := s.ListArenaClients(ctx, arenaID)
	if err != nil {
		return nil, err
	}
	for i := range all {
		if all[i].ID == row.ID {
			return &all[i], nil
		}
	}
	return nil, ErrClientNotFound
}

func (s *Service) UpdateArenaClient(ctx context.Context, arenaID, clientID uint, req UpdateArenaClientRequest) (*ArenaClientView, error) {
	var existing ArenaClient
	if err := s.db.WithContext(ctx).Where("id = ? AND arena_id = ?", clientID, arenaID).Take(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrClientNotFound
		}
		return nil, err
	}

	updates := map[string]any{"updated_at": time.Now()}
	if req.Name != nil {
		name, err := validateClientName(*req.Name)
		if err != nil {
			return nil, err
		}
		updates["display_name"] = name
	}
	if req.Phone != nil {
		phone, phoneKey, err := validateClientPhone(*req.Phone)
		if err != nil {
			return nil, err
		}
		updates["display_phone"] = phone
		updates["phone_key"] = phoneKey
		if existing.UserID == nil {
			if uid := resolveUserByPhoneKey(s.db.WithContext(ctx), phoneKey); uid != nil {
				updates["user_id"] = *uid
			}
		}
	}
	if req.Segment != nil {
		seg := strings.TrimSpace(*req.Segment)
		switch seg {
		case "", "vip", "regular", "new", "blocked":
		default:
			return nil, ErrInvalidSegment
		}
		updates["segment_override"] = seg
	}
	if req.Tags != nil {
		updates["tags"] = strings.TrimSpace(*req.Tags)
	}
	if req.Notes != nil {
		notes := strings.TrimSpace(*req.Notes)
		if utf8.RuneCountInString(notes) > 2000 {
			return nil, ErrClientNoteTooLong
		}
		updates["notes"] = notes
	}

	if err := s.db.WithContext(ctx).Model(&ArenaClient{}).Where("id = ? AND arena_id = ?", clientID, arenaID).Updates(updates).Error; err != nil {
		return nil, err
	}

	all, err := s.ListArenaClients(ctx, arenaID)
	if err != nil {
		return nil, err
	}
	for i := range all {
		if all[i].ID == clientID {
			return &all[i], nil
		}
	}
	return nil, ErrClientNotFound
}

func (s *Service) ListClientBookings(ctx context.Context, arenaID, clientID uint) ([]Booking, error) {
	var c ArenaClient
	if err := s.db.WithContext(ctx).Where("id = ? AND arena_id = ?", clientID, arenaID).Take(&c).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrClientNotFound
		}
		return nil, err
	}

	q := s.db.WithContext(ctx).Table("bookings").
		Select("bookings.*, halls.title as hall_title, halls.sport_type as sport_type, arenas.title as arena_title, client_ratings.score as client_rating").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Joins("JOIN arenas ON arenas.id = bookings.arena_id").
		Joins("LEFT JOIN client_ratings ON client_ratings.booking_id = bookings.id").
		Where("bookings.arena_id = ?", arenaID)

	if c.UserID != nil && len(c.PhoneKey) == 10 {
		q = q.Where("(bookings.user_id = ? OR RIGHT(regexp_replace(COALESCE(bookings.client_phone, ''), '[^0-9]', '', 'g'), 10) = ?)", *c.UserID, c.PhoneKey)
	} else if c.UserID != nil {
		q = q.Where("bookings.user_id = ?", *c.UserID)
	} else if len(c.PhoneKey) == 10 {
		q = q.Where("RIGHT(regexp_replace(COALESCE(bookings.client_phone, ''), '[^0-9]', '', 'g'), 10) = ?", c.PhoneKey)
	} else if strings.HasPrefix(c.PhoneKey, "raw:") {
		q = q.Where("'raw:' || LOWER(TRIM(bookings.client_name)) = ?", c.PhoneKey)
	}

	var items []Booking
	if err := q.Order("bookings.booking_date DESC, bookings.start_time DESC, bookings.id DESC").Limit(100).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

func (h *Handler) ListOwnClients(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrNoOwnArena) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"clients": []ArenaClientView{}})
			return
		}
		http.Error(w, `{"error":"failed to resolve arena"}`, http.StatusInternalServerError)
		return
	}
	clients, err := h.service.ListArenaClients(r.Context(), arenaID)
	if err != nil {
		http.Error(w, `{"error":"failed to list clients"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"clients": clients})
}

func (h *Handler) CreateOwnClient(w http.ResponseWriter, r *http.Request) {
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
	var req CreateArenaClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	client, err := h.service.CreateArenaClient(r.Context(), arenaID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{"client": client})
}

func (h *Handler) UpdateOwnClient(w http.ResponseWriter, r *http.Request) {
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
	clientID, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid client id"}`, http.StatusBadRequest)
		return
	}
	var req UpdateArenaClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	client, err := h.service.UpdateArenaClient(r.Context(), arenaID, uint(clientID), req)
	if err != nil {
		if errors.Is(err, ErrClientNotFound) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"client": client})
}

func (h *Handler) ListOwnClientBookings(w http.ResponseWriter, r *http.Request) {
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
	clientID, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid client id"}`, http.StatusBadRequest)
		return
	}
	bookings, err := h.service.ListClientBookings(r.Context(), arenaID, uint(clientID))
	if err != nil {
		if errors.Is(err, ErrClientNotFound) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to load client bookings"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"bookings": bookings})
}
