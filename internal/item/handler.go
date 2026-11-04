package item

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"alango/internal/audit"
	"alango/internal/auth"
	"alango/internal/realtime"
	"alango/internal/upload"

	"github.com/gorilla/mux"
)

type Handler struct {
	service       *Service
	uploadService *upload.Service
	auditService  *audit.Service
	hub           *realtime.Hub
}

func NewHandler(
	service *Service,
	uploadService *upload.Service,
	auditService *audit.Service,
	hub *realtime.Hub,
) *Handler {
	return &Handler{
		service:       service,
		uploadService: uploadService,
		auditService:  auditService,
		hub:           hub,
	}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	userID, _ := strconv.ParseUint(q.Get("user_id"), 10, 64)

	res, err := h.service.List(r.Context(), ListFilter{
		Category: strings.TrimSpace(q.Get("category")),
		Status:   strings.TrimSpace(q.Get("status")),
		Search:   strings.TrimSpace(q.Get("q")),
		UserID:   uint(userID),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		http.Error(w, "failed to list items", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))

	res, err := h.service.List(r.Context(), ListFilter{
		Category: strings.TrimSpace(q.Get("category")),
		Status:   strings.TrimSpace(q.Get("status")),
		Search:   strings.TrimSpace(q.Get("q")),
		UserID:   userID,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		http.Error(w, "failed to list items", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id == 0 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	it, err := h.service.GetByID(r.Context(), uint(id))
	if err != nil {
		if errors.Is(err, ErrItemNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		http.Error(w, "failed to get item", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(it)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		http.Error(w, "title is required", http.StatusBadRequest)
		return
	}

	it, err := h.service.Create(r.Context(), userID, &req)
	if err != nil {
		http.Error(w, "failed to create item", http.StatusInternalServerError)
		return
	}

	if h.auditService != nil {
		h.auditService.Log(userID, audit.ActionItemCreate, it.Title, r)
	}
	if h.hub != nil {
		h.hub.Publish(userID, realtime.NewItemEvent(realtime.EventItemCreated, it.ID, it))
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(it)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id == 0 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req UpdateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Title != nil && strings.TrimSpace(*req.Title) == "" {
		http.Error(w, "title is required", http.StatusBadRequest)
		return
	}

	updated, oldImage, err := h.service.Update(r.Context(), uint(id), userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrItemNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		case errors.Is(err, ErrForbidden):
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "failed to update item", http.StatusInternalServerError)
		}
		return
	}

	if oldImage != "" && oldImage != updated.ImageURL && h.uploadService != nil {
		_ = h.uploadService.DeleteImage(oldImage)
	}
	if h.auditService != nil {
		h.auditService.Log(userID, audit.ActionItemUpdate, updated.Title, r)
	}
	if h.hub != nil {
		h.hub.Publish(userID, realtime.NewItemEvent(realtime.EventItemUpdated, updated.ID, updated))
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id == 0 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, upload.MaxUploadSize+1024)
	if err := r.ParseMultipartForm(upload.MaxUploadSize); err != nil {
		http.Error(w, upload.ErrFileTooLarge.Error(), http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "photo file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	url, err := h.uploadService.SaveImage(file, header)
	if err != nil {
		if errors.Is(err, upload.ErrFileTooLarge) {
			http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		if errors.Is(err, upload.ErrInvalidType) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to save photo", http.StatusInternalServerError)
		return
	}

	updated, oldImage, err := h.service.Update(r.Context(), uint(id), userID, &UpdateItemRequest{ImageURL: &url})
	if err != nil {
		_ = h.uploadService.DeleteImage(url)
		switch {
		case errors.Is(err, ErrItemNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		case errors.Is(err, ErrForbidden):
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "failed to update item image", http.StatusInternalServerError)
		}
		return
	}

	if oldImage != "" && oldImage != url {
		_ = h.uploadService.DeleteImage(oldImage)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id == 0 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	oldImage, err := h.service.Delete(r.Context(), uint(id), userID)
	if err != nil {
		switch {
		case errors.Is(err, ErrItemNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		case errors.Is(err, ErrForbidden):
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "failed to delete item", http.StatusInternalServerError)
		}
		return
	}

	if oldImage != "" && h.uploadService != nil {
		_ = h.uploadService.DeleteImage(oldImage)
	}
	if h.auditService != nil {
		h.auditService.Log(userID, audit.ActionItemDelete, strconv.FormatUint(id, 10), r)
	}
	if h.hub != nil {
		h.hub.Publish(userID, realtime.NewItemEvent(realtime.EventItemDeleted, uint(id), nil))
	}

	w.WriteHeader(http.StatusNoContent)
}
