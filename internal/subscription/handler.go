package subscription

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"alango/internal/audit"
	"alango/internal/auth"
	"github.com/gorilla/mux"
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

	pendingReq, _ := h.service.GetPendingRequest(userID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(SubscriptionResponse{
		Current:        plan,
		ExpiresAt:      expiresAt,
		Plans:          h.service.ListCatalog(),
		PendingRequest: pendingReq,
	})
}

// RequestChange submits a subscription plan change request for admin approval
func (h *Handler) RequestChange(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body CreateSubscriptionRequestDTO
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req, err := h.service.CreateRequest(userID, body.Plan)
	if err != nil {
		if errors.Is(err, ErrInvalidPlan) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to submit subscription request", http.StatusInternalServerError)
		return
	}

	if h.auditService != nil {
		h.auditService.Log(userID, audit.ActionPlanChange, "request:"+body.Plan, r)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Заявка отправлена. Ожидайте подтверждения от администратора",
		"request": req,
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

// AdminListRequests returns all subscription requests
func (h *Handler) AdminListRequests(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	list, err := h.service.ListRequests(status)
	if err != nil {
		http.Error(w, "failed to fetch requests", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"requests": list,
	})
}

// AdminApproveRequest approves a subscription request and applies the new plan
func (h *Handler) AdminApproveRequest(w http.ResponseWriter, r *http.Request) {
	idStr := mux.Vars(r)["id"]
	id64, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid request id", http.StatusBadRequest)
		return
	}

	var body AdminReviewRequestDTO
	_ = json.NewDecoder(r.Body).Decode(&body)

	req, err := h.service.ApproveRequest(uint(id64), body.Notes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Заявка успешно одобрена, тариф активирован",
		"request": req,
	})
}

// AdminRejectRequest rejects a subscription request
func (h *Handler) AdminRejectRequest(w http.ResponseWriter, r *http.Request) {
	idStr := mux.Vars(r)["id"]
	id64, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid request id", http.StatusBadRequest)
		return
	}

	var body AdminReviewRequestDTO
	_ = json.NewDecoder(r.Body).Decode(&body)

	req, err := h.service.RejectRequest(uint(id64), body.Notes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Заявка отклонена",
		"request": req,
	})
}
