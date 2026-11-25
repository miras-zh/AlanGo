package sport

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"alango/internal/auth"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// loadOwnBooking reads {id} from the path and returns the booking when the
// caller owns its arena (writes 400/401/403/404 otherwise).
func (h *Handler) loadOwnBooking(w http.ResponseWriter, r *http.Request) (*Booking, bool) {
	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id == 0 {
		http.Error(w, `{"error":"invalid booking id"}`, http.StatusBadRequest)
		return nil, false
	}
	b, err := h.service.GetBookingByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"booking not found"}`, http.StatusNotFound)
		return nil, false
	}
	if !h.requireArenaOwner(w, r, b.ArenaID) {
		return nil, false
	}
	return b, true
}

func actorFrom(r *http.Request) *uint {
	if uid, ok := auth.GetUserID(r); ok {
		u := uint(uid)
		return &u
	}
	return nil
}

func writeBookingResult(w http.ResponseWriter, b *Booking, err error) {
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "booking not found"})
			return
		}
		writeJSON(w, bookingErrorStatus(err), map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, b)
}

// UpdateBookingStatus — PATCH /api/bookings/{id}/status.
// Arena owner can set confirmed|rejected|cancelled|completed; the booking's
// client can cancel their own booking (status = "cancelled").
func (h *Handler) UpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id == 0 {
		http.Error(w, `{"error":"invalid booking id"}`, http.StatusBadRequest)
		return
	}
	current, err := h.service.GetBookingByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"booking not found"}`, http.StatusNotFound)
		return
	}

	var req UpdateBookingStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	isOwner, ownerErr := h.service.IsArenaOwner(r.Context(), userID, current.ArenaID)
	if ownerErr != nil {
		http.Error(w, `{"error":"failed to check arena owner"}`, http.StatusInternalServerError)
		return
	}
	isClient := current.UserID != nil && *current.UserID == userID

	if !isOwner && !isClient {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}
	if !isOwner && req.Status != "cancelled" {
		http.Error(w, `{"error":"only the arena owner can set this status"}`, http.StatusForbidden)
		return
	}

	b, err := h.service.UpdateBookingStatus(r.Context(), current.ID, req.Status, req.Reason, actorFrom(r))
	writeBookingResult(w, b, err)
}

// RescheduleBooking — PATCH /api/bookings/{id}/reschedule (arena owner).
func (h *Handler) RescheduleBooking(w http.ResponseWriter, r *http.Request) {
	current, ok := h.loadOwnBooking(w, r)
	if !ok {
		return
	}
	var req RescheduleBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	b, err := h.service.RescheduleBooking(r.Context(), current.ID, req, actorFrom(r))
	writeBookingResult(w, b, err)
}

// UpdateBookingPayment — PATCH /api/bookings/{id}/payment (arena owner).
func (h *Handler) UpdateBookingPayment(w http.ResponseWriter, r *http.Request) {
	current, ok := h.loadOwnBooking(w, r)
	if !ok {
		return
	}
	var req UpdateBookingPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	b, err := h.service.UpdateBookingPayment(r.Context(), current.ID, req.PaidAmount)
	writeBookingResult(w, b, err)
}

// UpdateBookingDetails — PATCH /api/bookings/{id} (arena owner): client name,
// phone and notes. Date/time changes go through /reschedule.
func (h *Handler) UpdateBookingDetails(w http.ResponseWriter, r *http.Request) {
	current, ok := h.loadOwnBooking(w, r)
	if !ok {
		return
	}
	var req UpdateBookingDetailsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	b, err := h.service.UpdateBookingDetails(r.Context(), current.ID, req)
	writeBookingResult(w, b, err)
}

// PendingBookingsCount — GET /api/business/bookings/pending-count: the
// number of requests waiting for the owner's answer (badge in the cabinet).
func (h *Handler) PendingBookingsCount(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if errors.Is(err, ErrNoOwnArena) {
		writeJSON(w, http.StatusOK, map[string]int64{"pending": 0})
		return
	}
	if err != nil {
		http.Error(w, `{"error":"failed to count bookings"}`, http.StatusInternalServerError)
		return
	}
	n, err := h.service.PendingBookingsCount(r.Context(), arenaID)
	if err != nil {
		http.Error(w, `{"error":"failed to count bookings"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"pending": n})
}
