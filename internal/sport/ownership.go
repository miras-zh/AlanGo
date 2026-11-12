package sport

import (
	"context"
	"errors"
	"net/http"

	"alango/internal/auth"

	"gorm.io/gorm"
)

// Arena ownership. Every write to an arena, its halls, schedule or bookings
// must come from the arena's owner (arenas.owner_id). Seed arenas have no
// owner, so nobody can edit them through the API.

var (
	ErrNotArenaOwner = errors.New("you are not the owner of this arena")
	ErrNoOwnArena    = errors.New("no business arena for this account")
)

func (s *Service) arenaOwnerID(ctx context.Context, arenaID uint) (*uint, error) {
	var arena Arena
	if err := s.db.WithContext(ctx).Select("id, owner_id").Where("id = ?", arenaID).Take(&arena).Error; err != nil {
		return nil, err
	}
	return arena.OwnerID, nil
}

// IsArenaOwner reports whether userID owns arenaID.
func (s *Service) IsArenaOwner(ctx context.Context, userID, arenaID uint) (bool, error) {
	owner, err := s.arenaOwnerID(ctx, arenaID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return owner != nil && *owner == userID, nil
}

// OwnArenaID returns the arena owned by userID.
func (s *Service) OwnArenaID(ctx context.Context, userID uint) (uint, error) {
	var arena Arena
	err := s.db.WithContext(ctx).Select("id").Where("owner_id = ?", userID).Order("id ASC").Take(&arena).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, ErrNoOwnArena
	}
	if err != nil {
		return 0, err
	}
	return arena.ID, nil
}

// requireArenaOwner writes 401/403/404 and returns false unless the caller owns arenaID.
func (h *Handler) requireArenaOwner(w http.ResponseWriter, r *http.Request, arenaID uint) bool {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return false
	}
	owner, err := h.service.arenaOwnerID(r.Context(), arenaID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			http.Error(w, `{"error":"arena not found"}`, http.StatusNotFound)
			return false
		}
		http.Error(w, `{"error":"failed to check arena owner"}`, http.StatusInternalServerError)
		return false
	}
	if owner == nil || *owner != userID {
		http.Error(w, `{"error":"you are not the owner of this arena"}`, http.StatusForbidden)
		return false
	}
	return true
}
