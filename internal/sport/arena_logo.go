package sport

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"alango/internal/upload"

	"github.com/gorilla/mux"
)

// SetArenaLogo stores the arena's logo URL ("" clears it).
func (s *Service) SetArenaLogo(ctx context.Context, arenaID uint, url string) error {
	return s.db.WithContext(ctx).Model(&Arena{}).
		Where("id = ?", arenaID).
		Update("logo_url", url).Error
}

func (h *Handler) loadOwnArena(w http.ResponseWriter, r *http.Request) (*Arena, bool) {
	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid arena id"}`, http.StatusBadRequest)
		return nil, false
	}
	if !h.requireArenaOwner(w, r, uint(id)) {
		return nil, false
	}
	arena, err := h.service.GetArenaByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
		return nil, false
	}
	return arena, true
}

func writeArenaLogo(w http.ResponseWriter, url string) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"logo_url": url})
}

// UploadArenaLogo replaces the arena logo (POST /api/arenas/{id}/logo,
// multipart field "photo"). Owner only; the previous file is removed.
func (h *Handler) UploadArenaLogo(w http.ResponseWriter, r *http.Request) {
	arena, ok := h.loadOwnArena(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, upload.MaxUploadSize+1024)
	if err := r.ParseMultipartForm(upload.MaxUploadSize); err != nil {
		http.Error(w, `{"error":"file exceeds the maximum upload size of 5MB"}`, http.StatusRequestEntityTooLarge)
		return
	}
	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, `{"error":"photo is required"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	url, err := h.uploads.SaveImage(file, header)
	if err != nil {
		switch {
		case errors.Is(err, upload.ErrFileTooLarge):
			http.Error(w, `{"error":"file exceeds the maximum upload size of 5MB"}`, http.StatusRequestEntityTooLarge)
		case errors.Is(err, upload.ErrInvalidType):
			http.Error(w, `{"error":"file must be a JPEG, PNG or WebP image"}`, http.StatusBadRequest)
		default:
			http.Error(w, `{"error":"failed to save logo"}`, http.StatusInternalServerError)
		}
		return
	}

	if err := h.service.SetArenaLogo(r.Context(), arena.ID, url); err != nil {
		_ = h.uploads.DeleteImage(url)
		http.Error(w, `{"error":"failed to save logo"}`, http.StatusInternalServerError)
		return
	}
	if old := arena.LogoURL; old != "" && old != url && h.uploads.IsOwnUpload(old) {
		_ = h.uploads.DeleteImage(old)
	}
	writeArenaLogo(w, url)
}

// DeleteArenaLogo removes the arena logo (DELETE /api/arenas/{id}/logo).
func (h *Handler) DeleteArenaLogo(w http.ResponseWriter, r *http.Request) {
	arena, ok := h.loadOwnArena(w, r)
	if !ok {
		return
	}
	if err := h.service.SetArenaLogo(r.Context(), arena.ID, ""); err != nil {
		http.Error(w, `{"error":"failed to delete logo"}`, http.StatusInternalServerError)
		return
	}
	if old := arena.LogoURL; old != "" && h.uploads.IsOwnUpload(old) {
		_ = h.uploads.DeleteImage(old)
	}
	writeArenaLogo(w, "")
}
