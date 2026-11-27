package notification

import (
	"encoding/json"
	"errors"
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

func (h *Handler) GetPushStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	st, err := h.service.PushStatus(userID)
	if err != nil {
		http.Error(w, "failed to inspect push status", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(st)
}

func (h *Handler) TestPush(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	st, err := h.service.SendTestPush(userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":  err.Error(),
			"status": st,
		})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"sent":   st.HasToken && st.TransportReady,
		"status": st,
	})
}

func (h *Handler) AdminBroadcast(w http.ResponseWriter, r *http.Request) {
	adminID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req PlatformBroadcastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	campaign, err := h.service.BroadcastPlatform(r.Context(), adminID, req)
	if err != nil {
		if errors.Is(err, ErrBroadcastTitleRequired) || errors.Is(err, ErrBroadcastBodyRequired) || errors.Is(err, ErrBroadcastTooLong) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"error":"failed to send broadcast"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{"campaign": campaign})
}

func (h *Handler) AdminListBroadcasts(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListPlatformCampaigns(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to list broadcasts"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"campaigns": items})
}

func (h *Handler) BusinessBroadcast(w http.ResponseWriter, r *http.Request) {
	ownerID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req ArenaBroadcastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	res, err := h.service.BroadcastArena(r.Context(), ownerID, req)
	if err != nil {
		if errors.Is(err, ErrBroadcastTitleRequired) || errors.Is(err, ErrBroadcastBodyRequired) || errors.Is(err, ErrBroadcastTooLong) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
		if errors.Is(err, ErrNoOwnedArena) {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to send broadcast"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) BusinessListBroadcasts(w http.ResponseWriter, r *http.Request) {
	ownerID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	items, err := h.service.ListArenaCampaigns(r.Context(), ownerID)
	if err != nil {
		http.Error(w, `{"error":"failed to list broadcasts"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"campaigns": items})
}
