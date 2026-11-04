package subscription

import (
	"encoding/json"
	"errors"
	"net/http"

	"alango/internal/audit"
	"alango/internal/auth"
)

type Handler struct {
	service      *Service
	auditService *audit.Service
}

func NewHandler(service *Service, auditService *audit.Service) *Handler {
	return &Handler{
		service:      service,
		auditService: auditService,
	}
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	plan, expiresAt, err := h.service.Get(userID)
	if err != nil {
		http.Error(w, "failed to get subscription", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(SubscriptionResponse{
		Current:   plan,
		ExpiresAt: expiresAt,
		Plans:     h.service.ListCatalog(),
	})
}

func (h *Handler) Change(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body ChangePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	expiresAt, err := h.service.Set(userID, body.Plan)
	if err != nil {
		if errors.Is(err, ErrInvalidPlan) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to update subscription", http.StatusInternalServerError)
		return
	}

	if h.auditService != nil {
		h.auditService.Log(userID, audit.ActionPlanChange, body.Plan, r)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(SubscriptionResponse{
		Current:   body.Plan,
		ExpiresAt: expiresAt,
		Plans:     h.service.ListCatalog(),
	})
}
