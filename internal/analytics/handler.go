package analytics

import (
	"encoding/json"
	"net/http"
	"strings"

	"alango/internal/auth"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type TrackRequest struct {
	EventType  string `json:"event_type"`
	TargetType string `json:"target_type"`
	TargetID   uint64 `json:"target_id"`
	Platform   string `json:"platform"`
	Source     string `json:"source"`
	DeviceID   string `json:"device_id"`
}

func (h *Handler) Track(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req TrackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.EventType = strings.TrimSpace(req.EventType)
	if !IsValidEvent(req.EventType) {
		http.Error(w, "invalid event_type", http.StatusBadRequest)
		return
	}

	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	} else {
		parts := strings.Split(ip, ",")
		ip = strings.TrimSpace(parts[0])
	}
	userAgent := r.UserAgent()

	_ = h.service.TrackEvent(req.EventType, req.TargetType, req.TargetID, req.Platform, req.Source, req.DeviceID, ip, userAgent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (h *Handler) GetFunnel(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.GetFunnelSummary(r.Context())
	if err != nil {
		http.Error(w, "failed to get funnel summary", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(summary)
}

func (h *Handler) Heartbeat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req HeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	userID, _ := auth.GetUserID(r)
	_ = h.service.Heartbeat(r.Context(), userID, req.GuestID, req.Platform, req.Path)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (h *Handler) GetOnline(w http.ResponseWriter, r *http.Request) {
	stats, err := h.service.GetOnlineStats(r.Context())
	if err != nil {
		http.Error(w, "failed to get online stats", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(stats)
}

func (h *Handler) GetTraffic(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	report, err := h.service.GetTrafficReport(r.Context(), period)
	if err != nil {
		http.Error(w, "failed to get traffic report", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(report)
}
