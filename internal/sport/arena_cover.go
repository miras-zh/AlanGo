package sport

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"alango/internal/upload"
)

// Arena cover (banner): the wide photo on the sports-complex card and the
// top of the business profile. Stored in arenas.image_url; uploaded by the
// owner via POST /api/arenas/{id}/cover, separate from the logo and from
// the halls' photos.

// SetArenaCover stores the arena's cover URL ("" clears it).
func (s *Service) SetArenaCover(ctx context.Context, arenaID uint, url string) error {
	return s.db.WithContext(ctx).Model(&Arena{}).
		Where("id = ?", arenaID).
		Update("image_url", url).Error
}

func writeArenaCover(w http.ResponseWriter, url string) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"image_url": url})
}

// UploadArenaCover replaces the arena cover (POST /api/arenas/{id}/cover,
// multipart field "photo"). Owner only; the previous uploaded file is removed.
func (h *Handler) UploadArenaCover(w http.ResponseWriter, r *http.Request) {
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
			http.Error(w, `{"error":"failed to save cover"}`, http.StatusInternalServerError)
		}
		return
	}

	if err := h.service.SetArenaCover(r.Context(), arena.ID, url); err != nil {
		_ = h.uploads.DeleteImage(url)
		http.Error(w, `{"error":"failed to save cover"}`, http.StatusInternalServerError)
		return
	}
	if old := arena.ImageURL; old != "" && old != url && h.uploads.IsOwnUpload(old) {
		_ = h.uploads.DeleteImage(old)
	}
	writeArenaCover(w, url)
}

// DeleteArenaCover removes the arena cover (DELETE /api/arenas/{id}/cover).
func (h *Handler) DeleteArenaCover(w http.ResponseWriter, r *http.Request) {
	arena, ok := h.loadOwnArena(w, r)
	if !ok {
		return
	}
	if err := h.service.SetArenaCover(r.Context(), arena.ID, ""); err != nil {
		http.Error(w, `{"error":"failed to delete cover"}`, http.StatusInternalServerError)
		return
	}
	if old := arena.ImageURL; old != "" && h.uploads.IsOwnUpload(old) {
		_ = h.uploads.DeleteImage(old)
	}
	writeArenaCover(w, "")
}
