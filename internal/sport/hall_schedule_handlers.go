package sport

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

func hallIDFromPath(w http.ResponseWriter, r *http.Request) (uint, bool) {
	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id == 0 {
		http.Error(w, `{"error":"invalid hall id"}`, http.StatusBadRequest)
		return 0, false
	}
	return uint(id), true
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// GetHallSchedule — GET /api/halls/{id}/schedule (public).
func (h *Handler) GetHallSchedule(w http.ResponseWriter, r *http.Request) {
	id, ok := hallIDFromPath(w, r)
	if !ok {
		return
	}
	if _, err := h.service.GetHallByID(r.Context(), id); err != nil {
		http.Error(w, `{"error":"hall not found"}`, http.StatusNotFound)
		return
	}
	week, err := h.service.GetHallSchedule(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"failed to get schedule"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"schedule": week})
}

// SaveHallSchedule — PUT /api/halls/{id}/schedule (arena owner only).
func (h *Handler) SaveHallSchedule(w http.ResponseWriter, r *http.Request) {
	hall, ok := h.loadOwnHall(w, r)
	if !ok {
		return
	}
	var req SaveHallScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Schedule) == 0 {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if err := h.service.SaveHallSchedule(r.Context(), hall.ID, req.Schedule); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	week, err := h.service.GetHallSchedule(r.Context(), hall.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to get schedule"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"schedule": week})
}

// HallAvailability — GET /api/halls/{id}/availability?date=YYYY-MM-DD&duration=60 (public).
// Returns slot statuses only, never who booked.
func (h *Handler) HallAvailability(w http.ResponseWriter, r *http.Request) {
	id, ok := hallIDFromPath(w, r)
	if !ok {
		return
	}
	duration, _ := strconv.Atoi(r.URL.Query().Get("duration"))
	res, err := h.service.HallAvailability(r.Context(), id, r.URL.Query().Get("date"), duration)
	if err != nil {
		if errors.Is(err, ErrInvalidDate) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		http.Error(w, `{"error":"hall not found"}`, http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// bookingErrorStatus maps booking validation errors to HTTP statuses.
func bookingErrorStatus(err error) int {
	switch {
	case errors.Is(err, ErrSlotTaken):
		return http.StatusConflict
	case errors.Is(err, ErrHallNotBookable):
		return http.StatusUnprocessableEntity
	default:
		return http.StatusBadRequest
	}
}
