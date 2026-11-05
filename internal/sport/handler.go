package sport

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"alango/internal/auth"

	"github.com/gorilla/mux"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
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

	var req Arena
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.ID = uint(id)
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
		w.WriteHeader(http.StatusBadRequest)
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
	q := r.URL.Query()
	arenaID, _ := strconv.ParseUint(q.Get("arena_id"), 10, 64)
	if arenaID == 0 {
		arenaID = 1 // Default to dev.arena1
	}

	dash, err := h.service.GetBusinessDashboard(r.Context(), uint(arenaID))
	if err != nil {
		http.Error(w, `{"error":"failed to load dashboard"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dash)
}
