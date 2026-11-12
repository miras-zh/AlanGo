package sport

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"alango/internal/upload"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

// MaxHallPhotos is the gallery size limit per hall.
const MaxHallPhotos = 5

func (h *Handler) loadOwnHall(w http.ResponseWriter, r *http.Request) (*Hall, bool) {
	id, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid hall id"}`, http.StatusBadRequest)
		return nil, false
	}
	hall, err := h.service.GetHallByID(r.Context(), uint(id))
	if err != nil {
		http.Error(w, `{"error":"hall not found"}`, http.StatusNotFound)
		return nil, false
	}
	if !h.requireArenaOwner(w, r, hall.ArenaID) {
		return nil, false
	}
	return hall, true
}

func writeHallPhotos(w http.ResponseWriter, hall *Hall) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"photos":    hall.Photos,
		"image_url": hall.ImageURL,
	})
}

// UploadHallPhoto adds one image to the hall gallery (POST /api/halls/{id}/photos,
// multipart field "photo"). Owner only, at most MaxHallPhotos images.
func (h *Handler) UploadHallPhoto(w http.ResponseWriter, r *http.Request) {
	hall, ok := h.loadOwnHall(w, r)
	if !ok {
		return
	}
	if len(hall.Photos) >= MaxHallPhotos {
		http.Error(w, `{"error":"a hall can have at most 5 photos"}`, http.StatusBadRequest)
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
			http.Error(w, `{"error":"failed to save photo"}`, http.StatusInternalServerError)
		}
		return
	}

	photos := append(pq.StringArray{}, hall.Photos...)
	photos = append(photos, url)
	updated, err := h.service.SetHallPhotos(r.Context(), hall.ID, photos)
	if err != nil {
		_ = h.uploads.DeleteImage(url)
		if errors.Is(err, ErrTooManyPhotos) {
			http.Error(w, `{"error":"a hall can have at most 5 photos"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"error":"failed to save photo"}`, http.StatusInternalServerError)
		return
	}
	writeHallPhotos(w, updated)
}

// DeleteHallPhoto removes one image from the gallery
// (DELETE /api/halls/{id}/photos?url=...). Owner only.
func (h *Handler) DeleteHallPhoto(w http.ResponseWriter, r *http.Request) {
	hall, ok := h.loadOwnHall(w, r)
	if !ok {
		return
	}
	target := strings.TrimSpace(r.URL.Query().Get("url"))
	photos := pq.StringArray{}
	found := false
	for _, p := range hall.Photos {
		if p == target && !found {
			found = true
			continue
		}
		photos = append(photos, p)
	}
	if !found {
		http.Error(w, `{"error":"photo not found in this hall"}`, http.StatusNotFound)
		return
	}

	updated, err := h.service.SetHallPhotos(r.Context(), hall.ID, photos)
	if err != nil {
		http.Error(w, `{"error":"failed to delete photo"}`, http.StatusInternalServerError)
		return
	}
	if h.uploads.IsOwnUpload(target) {
		_ = h.uploads.DeleteImage(target)
	}
	writeHallPhotos(w, updated)
}
