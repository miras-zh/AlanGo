package sport

import (
	"alango/internal/upload"

	"encoding/json"
	"errors"
	"github.com/lib/pq"
	"net/http"
	"strconv"
	"strings"

	"alango/internal/auth"

	"github.com/gorilla/mux"
)

type Handler struct {
	service *Service
	uploads *upload.Service
}

func NewHandler(service *Service, uploads *upload.Service) *Handler {
	return &Handler{service: service, uploads: uploads}
}

// ============================================================================
// ARENAS
// ============================================================================

func (h *Handler) ListArenas(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := strings.TrimSpace(q.Get("q"))
	city := strings.TrimSpace(q.Get("city"))
	district := strings.TrimSpace(q.Get("district"))
	sport := strings.TrimSpace(q.Get("sport"))

	arenas, err := h.service.ListArenas(r.Context(), search, city, district, sport)
	if err != nil {
		http.Error(w, `{"error":"failed to list arenas"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"arenas": arenas,
		"total":  len(arenas),
	})
}

func (h *Handler) GetArena(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid arena id"}`, http.StatusBadRequest)
		return
	}

	arena, err := h.service.GetArenaByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(arena)
}

func (h *Handler) UpdateArena(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid arena id"}`, http.StatusBadRequest)
		return
	}

	if !h.requireArenaOwner(w, r, uint(id)) {
		return
	}
	existing, err := h.service.GetArenaByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return
	}

	// Decode on top of the stored arena: fields missing from the body keep
	// their values (a partial body used to null out features/sports → 500).
	// Snapshot protected fields by value first: OwnerID is a pointer shared
	// by the copy, so decoding "owner_id" would otherwise write through it.
	var ownerID *uint
	if existing.OwnerID != nil {
		v := *existing.OwnerID
		ownerID = &v
	}
	protected := *existing
	req := *existing
	req.OwnerID = nil
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.Features == nil {
		req.Features = protected.Features
	}
	if req.Sports == nil {
		req.Sports = protected.Sports
	}

	// Fields the owner must not change through this endpoint.
	req.ID = uint(id)
	req.OwnerID = ownerID
	req.OwnerEmail = protected.OwnerEmail
	req.Hidden = protected.Hidden
	req.VenueType = protected.VenueType
	req.Rating = protected.Rating
	req.ReviewsCount = protected.ReviewsCount
	req.CreatedAt = protected.CreatedAt
	req.Halls = nil
	if err := h.service.SaveArena(r.Context(), &req); err != nil {
		http.Error(w, `{"error":"failed to update arena"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(req)
}

// ============================================================================
// HALLS
// ============================================================================

func (h *Handler) ListHalls(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	sport := strings.TrimSpace(q.Get("sport"))
	search := strings.TrimSpace(q.Get("q"))
	arenaID, _ := strconv.ParseUint(q.Get("arena_id"), 10, 64)

	halls, err := h.service.ListHalls(r.Context(), sport, uint(arenaID), search)
	if err != nil {
		http.Error(w, `{"error":"failed to list halls"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"halls": halls,
		"total": len(halls),
	})
}

func (h *Handler) GetHall(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid hall id"}`, http.StatusBadRequest)
		return
	}

	hall, err := h.service.GetHallByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"hall not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(hall)
}

func (h *Handler) CreateHall(w http.ResponseWriter, r *http.Request) {
	var req Hall
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" || req.ArenaID == 0 {
		http.Error(w, `{"error":"title and arena_id are required"}`, http.StatusBadRequest)
		return
	}
	if !h.requireArenaOwner(w, r, req.ArenaID) {
		return
	}
	// An id means "update this hall": it must already belong to the same arena.
	if req.ID != 0 {
		existing, err := h.service.GetHallByID(r.Context(), req.ID)
		if err != nil || existing.ArenaID != req.ArenaID {
			http.Error(w, `{"error":"hall not found in this arena"}`, http.StatusForbidden)
			return
		}
		req.Rating = existing.Rating
		req.ReviewsCount = existing.ReviewsCount
		req.CreatedAt = existing.CreatedAt
		// The gallery is managed only by the /photos endpoints.
		req.Photos = existing.Photos
		req.ImageURL = existing.ImageURL
	} else {
		// New hall: no stock image, the cover comes from the first uploaded photo.
		req.Photos = pq.StringArray{}
		req.ImageURL = ""
		req.Rating = 0
		req.ReviewsCount = 0
	}
	if req.Photos == nil {
		req.Photos = pq.StringArray{}
	}
	if req.Equipment == nil {
		req.Equipment = pq.StringArray{}
	}
	if req.LengthM < 0 || req.LengthM > 1000 || req.WidthM < 0 || req.WidthM > 1000 || req.MaxPeople < 0 || req.MaxPeople > 10000 {
		http.Error(w, `{"error":"invalid hall size or capacity"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.SaveHall(r.Context(), &req); err != nil {
		http.Error(w, `{"error":"failed to create hall"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(req)
}

// ============================================================================
// SCHEDULES
// ============================================================================

func (h *Handler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	arenaID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid arena id"}`, http.StatusBadRequest)
		return
	}

	schedule, err := h.service.GetArenaSchedule(r.Context(), uint(arenaID))
	if err != nil {
		http.Error(w, `{"error":"failed to get schedule"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"schedule": schedule,
	})
}

func (h *Handler) SaveSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	arenaID, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid arena id"}`, http.StatusBadRequest)
		return
	}

	if !h.requireArenaOwner(w, r, uint(arenaID)) {
		return
	}

	var req SaveScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.SaveArenaSchedule(r.Context(), uint(arenaID), req.Schedule); err != nil {
		http.Error(w, `{"error":"failed to save schedule"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

// ============================================================================
// BOOKINGS
// ============================================================================

func (h *Handler) CreateBooking(w http.ResponseWriter, r *http.Request) {
	var req CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	var userID *uint
	if uid, ok := auth.GetUserID(r); ok {
		u := uint(uid)
		userID = &u
	}

	booking, err := h.service.CreateBooking(r.Context(), req, userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(bookingErrorStatus(err))
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(booking)
}

func (h *Handler) ListBookings(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	arenaID, _ := strconv.ParseUint(q.Get("arena_id"), 10, 64)
	hallID, _ := strconv.ParseUint(q.Get("hall_id"), 10, 64)
	date := strings.TrimSpace(q.Get("date"))
	status := strings.TrimSpace(q.Get("status"))

	var filterUserID *uint
	if q.Get("my") == "true" {
		if uid, ok := auth.GetUserID(r); ok {
			u := uint(uid)
			filterUserID = &u
		}
	}

	bookings, err := h.service.ListBookings(r.Context(), uint(arenaID), uint(hallID), date, status, filterUserID)
	if err != nil {
		http.Error(w, `{"error":"failed to list bookings"}`, http.StatusInternalServerError)
		return
	}
	// Public list is for slot availability only: never expose who booked.
	// "my=true" (signed in) returns the caller's own bookings in full.
	for i := range bookings {
		if filterUserID != nil {
			break
		}
		bookings[i].ClientName = ""
		bookings[i].ClientPhone = ""
		bookings[i].Notes = ""
		bookings[i].UserID = nil
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"bookings": bookings,
		"total":    len(bookings),
	})
}

func (h *Handler) UpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid booking id"}`, http.StatusBadRequest)
		return
	}

	current, err := h.service.GetBookingByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"booking not found"}`, http.StatusNotFound)
		return
	}
	if !h.requireArenaOwner(w, r, current.ArenaID) {
		return
	}

	var req UpdateBookingStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	booking, err := h.service.UpdateBookingStatus(r.Context(), uint(id), req.Status)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(booking)
}

func (h *Handler) GetBusinessDashboard(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrNoOwnArena) {
			http.Error(w, `{"error":"no business arena for this account"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to load dashboard"}`, http.StatusInternalServerError)
		return
	}

	dash, err := h.service.GetBusinessDashboard(r.Context(), arenaID)
	if err != nil {
		http.Error(w, `{"error":"failed to load dashboard"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dash)
}

// ListOwnBookings returns the caller's arena bookings with client contacts
// (GET /api/business/bookings). The public /api/bookings hides them.
func (h *Handler) ListOwnBookings(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	arenaID, err := h.service.OwnArenaID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrNoOwnArena) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"bookings": []Booking{}, "total": 0})
			return
		}
		http.Error(w, `{"error":"failed to list bookings"}`, http.StatusInternalServerError)
		return
	}

	q := r.URL.Query()
	hallID, _ := strconv.ParseUint(q.Get("hall_id"), 10, 64)
	bookings, err := h.service.ListBookings(r.Context(), arenaID, uint(hallID),
		strings.TrimSpace(q.Get("date")), strings.TrimSpace(q.Get("status")), nil)
	if err != nil {
		http.Error(w, `{"error":"failed to list bookings"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"bookings": bookings,
		"total":    len(bookings),
	})
}
