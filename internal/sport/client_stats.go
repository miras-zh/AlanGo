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

	"alango/internal/auth"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Client statistics shown on the profile: games played, hours on court and
// the rating businesses gave the client. A new account starts at 0 / 0 / 5.0.

const DefaultClientRating = 5.0

var (
	ErrBookingNotFinished = errors.New("rate the client after the booking has ended")
	ErrBookingNoClient    = errors.New("booking has no registered client to rate")
	ErrInvalidScore       = errors.New("score must be between 1 and 5")
)

// ClientRating — one score per booking, set by the arena owner.
type ClientRating struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	BookingID uint      `gorm:"column:booking_id" json:"booking_id"`
	UserID    uint      `gorm:"column:user_id" json:"user_id"`
	ArenaID   uint      `gorm:"column:arena_id" json:"arena_id"`
	RatedBy   uint      `gorm:"column:rated_by" json:"rated_by"`
	Score     int       `gorm:"column:score" json:"score"`
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (ClientRating) TableName() string { return "client_ratings" }

type ClientStats struct {
	GamesPlayed   int     `json:"games_played"`
	MinutesPlayed int     `json:"minutes_played"`
	Rating        float64 `json:"rating"`
	RatingsCount  int     `json:"ratings_count"`
}

// bookingEnd returns when a booking ends in venue time.
func bookingEnd(b Booking) (time.Time, bool) {
	end := strings.TrimSpace(b.EndTime)
	if end == "" {
		return time.Time{}, false
	}
	if end == "24:00" {
		end = "23:59"
	}
	t, err := time.ParseInLocation("2006-01-02 15:04", strings.TrimSpace(b.BookingDate)+" "+end, venueTZ)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

// ClientStats counts the user's finished, non-cancelled bookings and averages
// the ratings businesses gave them.
func (s *Service) ClientStats(ctx context.Context, userID uint) (ClientStats, error) {
	stats := ClientStats{Rating: DefaultClientRating}

	var bookings []Booking
	if err := s.db.WithContext(ctx).
		Select("id, booking_date, end_time, duration_minutes, status").
		Where("user_id = ? AND status <> 'cancelled'", userID).
		Find(&bookings).Error; err != nil {
		return stats, err
	}
	now := time.Now().In(venueTZ)
	for _, b := range bookings {
		end, ok := bookingEnd(b)
		if b.Status != "completed" && (!ok || end.After(now)) {
			continue
		}
		stats.GamesPlayed++
		stats.MinutesPlayed += b.DurationMinutes
	}

	var agg struct {
		Avg   *float64
		Count int
	}
	if err := s.db.WithContext(ctx).Model(&ClientRating{}).
		Select("AVG(score) AS avg, COUNT(*) AS count").
		Where("user_id = ?", userID).
		Scan(&agg).Error; err != nil {
		return stats, err
	}
	if agg.Count > 0 && agg.Avg != nil {
		stats.Rating = math.Round(*agg.Avg*10) / 10
		stats.RatingsCount = agg.Count
	}
	return stats, nil
}

// RateClient stores (or updates) the owner's score for a finished booking.
func (s *Service) RateClient(ctx context.Context, ownerID, bookingID uint, score int) (*ClientRating, error) {
	if score < 1 || score > 5 {
		return nil, ErrInvalidScore
	}
	var b Booking
	if err := s.db.WithContext(ctx).Where("id = ?", bookingID).Take(&b).Error; err != nil {
		return nil, err
	}
	isOwner, err := s.IsArenaOwner(ctx, ownerID, b.ArenaID)
	if err != nil {
		return nil, err
	}
	if !isOwner {
		return nil, ErrNotArenaOwner
	}
	if b.UserID == nil {
		return nil, ErrBookingNoClient
	}
	if b.Status == "cancelled" {
		return nil, ErrBookingNotFinished
	}
	if end, ok := bookingEnd(b); b.Status != "completed" && (!ok || end.After(time.Now().In(venueTZ))) {
		return nil, ErrBookingNotFinished
	}

	now := time.Now()
	rating := ClientRating{
		BookingID: b.ID,
		UserID:    *b.UserID,
		ArenaID:   b.ArenaID,
		RatedBy:   ownerID,
		Score:     score,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "booking_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{"score": score, "rated_by": ownerID, "updated_at": now}),
	}).Create(&rating).Error; err != nil {
		return nil, err
	}
	return &rating, nil
}

// GetMyStats — GET /api/me/stats.
func (h *Handler) GetMyStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	stats, err := h.service.ClientStats(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"failed to load stats"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// RateBookingClient — PUT /api/bookings/{id}/client-rating {"score": 1..5}.
// Only the owner of the booking's arena, only after the booking has ended.
func (h *Handler) RateBookingClient(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid booking id"}`, http.StatusBadRequest)
		return
	}
	var body struct {
		Score int `json:"score"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	rating, err := h.service.RateClient(r.Context(), userID, uint(id), body.Score)
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, rating)
	case errors.Is(err, gorm.ErrRecordNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "booking not found"})
	case errors.Is(err, ErrNotArenaOwner):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
	case errors.Is(err, ErrInvalidScore), errors.Is(err, ErrBookingNotFinished), errors.Is(err, ErrBookingNoClient):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save rating"})
	}
}
