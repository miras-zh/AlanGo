package notification

import (
	"encoding/json"
	"net/http"

	"alango/internal/auth"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	items, unread, err := h.service.List(userID)
	if err != nil {
		http.Error(w, "failed to get notifications", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"items":        items,
		"unread_count": unread,
	})
}

func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := h.service.MarkAllRead(userID); err != nil {
		http.Error(w, "failed to mark notifications read", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
