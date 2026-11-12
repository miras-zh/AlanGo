package user

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"alango/internal/audit"
	"alango/internal/auth"

	"github.com/lib/pq"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Self-service business accounts (mirrors Vison's creator/studio switch).
//
// A client opens a business account through the onboarding wizard: we create
// the arena they own and flip users.role to "business". Disabling switches
// the role back to "client" and hides the arena from the public catalog;
// users.business_role = "business" remembers that an arena exists, so
// enabling again needs no onboarding and loses no data.

const (
	RoleClient   = "client"
	RoleBusiness = "business"

	maxArenaTitleBytes = 120
	maxSports          = 12
)

var (
	ErrBusinessAlreadyExists = errors.New("business account already exists, enable it instead")
	ErrNotBusiness           = errors.New("account is not in business mode")
	ErrNoBusiness            = errors.New("no business account to enable")
	ErrBusinessRoleForbidden = errors.New("this account cannot open a business account")
	ErrInvalidVenueType      = errors.New("venue_type must be complex, single or outdoor")
	ErrArenaTitleRequired    = errors.New("title is required")
	ErrArenaTitleTooLong     = errors.New("title is too long")
	ErrSportsRequired        = errors.New("choose at least one sport")
	ErrCityRequired          = errors.New("city is required")
)

// venueCategory is the human label stored in arenas.category (shown in the catalog).
var venueCategory = map[string]string{
	"complex": "Спорткомплекс",
	"single":  "Отдельный зал",
	"outdoor": "Открытая площадка",
}

type BusinessOnboardRequest struct {
	VenueType string   `json:"venue_type"`
	Title     string   `json:"title"`
	Sports    []string `json:"sports"`
	City      string   `json:"city"`
}

// BusinessArena is the owner's view of their arena (the sport package owns
// the full model; this package only needs these columns).
type BusinessArena struct {
	ID         uint           `json:"id"`
	Title      string         `json:"title"`
	Category   string         `json:"category"`
	VenueType  string         `json:"venue_type"`
	City       string         `json:"city"`
	Address    string         `json:"address"`
	Sports     pq.StringArray `gorm:"type:text[]" json:"sports"`
	HallsCount int            `json:"halls_count"`
	Hidden     bool           `json:"hidden"`
}

func (req *BusinessOnboardRequest) normalize() error {
	req.VenueType = strings.TrimSpace(req.VenueType)
	req.Title = strings.TrimSpace(req.Title)
	req.City = strings.TrimSpace(req.City)

	if _, ok := venueCategory[req.VenueType]; !ok {
		return ErrInvalidVenueType
	}
	if req.Title == "" {
		return ErrArenaTitleRequired
	}
	if len(req.Title) > maxArenaTitleBytes || !utf8.ValidString(req.Title) {
		return ErrArenaTitleTooLong
	}
	if req.City == "" {
		return ErrCityRequired
	}

	seen := make(map[string]bool, len(req.Sports))
	sports := make([]string, 0, len(req.Sports))
	for _, s := range req.Sports {
		s = strings.TrimSpace(s)
		if s == "" || seen[s] || len(s) > 64 {
			continue
		}
		seen[s] = true
		sports = append(sports, s)
	}
	if len(sports) == 0 {
		return ErrSportsRequired
	}
	if len(sports) > maxSports {
		sports = sports[:maxSports]
	}
	req.Sports = sports
	return nil
}

func (s *UserService) ownArena(tx *gorm.DB, userID uint) (*BusinessArena, error) {
	var arena BusinessArena
	err := tx.Table("arenas").
		Select("id, title, category, venue_type, city, address, sports, halls_count, hidden").
		Where("owner_id = ?", userID).
		Order("id ASC").
		Take(&arena).Error
	if err != nil {
		return nil, err
	}
	return &arena, nil
}

// GetOwnArena returns the caller's arena, or gorm.ErrRecordNotFound.
func (s *UserService) GetOwnArena(userID uint) (*BusinessArena, error) {
	return s.ownArena(s.DB, userID)
}

// OnboardBusiness creates the caller's arena and switches them to business mode.
func (s *UserService) OnboardBusiness(userID uint, req BusinessOnboardRequest) (*User, *BusinessArena, error) {
	if err := req.normalize(); err != nil {
		return nil, nil, err
	}

	var updated User
	var arena *BusinessArena
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var u User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", userID).First(&u).Error; err != nil {
			return err
		}
		if u.Role != RoleClient && u.Role != "" {
			if u.Role == RoleBusiness {
				return ErrBusinessAlreadyExists
			}
			return ErrBusinessRoleForbidden
		}
		if existing, err := s.ownArena(tx, userID); err == nil && existing != nil {
			return ErrBusinessAlreadyExists
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		hallsCount := 0
		if req.VenueType != "complex" {
			hallsCount = 1
		}
		now := time.Now()
		row := map[string]any{
			"owner_id":           userID,
			"owner_email":        u.Email,
			"title":              req.Title,
			"category":           venueCategory[req.VenueType],
			"venue_type":         req.VenueType,
			"city":               req.City,
			"district":           "",
			"address":            "",
			"phone":              u.Phone,
			"rating":             0,
			"reviews_count":      0,
			"min_price_per_hour": 0,
			"halls_count":        hallsCount,
			"sports":             pq.StringArray(req.Sports),
			"hidden":             false,
			"created_at":         now,
			"updated_at":         now,
		}
		var arenaID uint
		if err := tx.Table("arenas").Create(row).Error; err != nil {
			return err
		}
		if err := tx.Table("arenas").Select("id").Where("owner_id = ?", userID).Order("id DESC").Take(&arenaID).Error; err != nil {
			return err
		}

		// A single hall / outdoor court *is* the venue: create its one hall
		// right away so it can be priced and booked. A complex adds halls later.
		if hallsCount == 1 {
			hall := map[string]any{
				"arena_id":       arenaID,
				"title":          req.Title,
				"sport_type":     req.Sports[0],
				"price_per_hour": 0,
				"status":         "active",
				"rating":         0,
				"reviews_count":  0,
				"created_at":     now,
				"updated_at":     now,
			}
			if err := tx.Table("halls").Create(hall).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&User{}).Where("id = ?", userID).Updates(map[string]any{
			"role":          RoleBusiness,
			"business_role": RoleBusiness,
		}).Error; err != nil {
			return err
		}
		u.Role = RoleBusiness
		u.BusinessRole = RoleBusiness
		updated = u

		a, err := s.ownArena(tx, userID)
		if err != nil {
			return err
		}
		arena = a
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return &updated, arena, nil
}

// DisableBusiness switches back to client mode and hides the arena.
func (s *UserService) DisableBusiness(userID uint) (*User, error) {
	var updated User
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var u User
		if err := tx.Where("id = ?", userID).First(&u).Error; err != nil {
			return err
		}
		if u.Role != RoleBusiness {
			return ErrNotBusiness
		}
		if err := tx.Table("arenas").Where("owner_id = ?", userID).Update("hidden", true).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Updates(map[string]any{
			"role":          RoleClient,
			"business_role": RoleBusiness,
		}).Error; err != nil {
			return err
		}
		u.Role = RoleClient
		u.BusinessRole = RoleBusiness
		updated = u
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

// EnableBusiness restores business mode for an owner who disabled it.
func (s *UserService) EnableBusiness(userID uint) (*User, error) {
	var updated User
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var u User
		if err := tx.Where("id = ?", userID).First(&u).Error; err != nil {
			return err
		}
		if u.Role == RoleBusiness {
			updated = u
			return nil
		}
		if u.Role != RoleClient {
			return ErrBusinessRoleForbidden
		}
		if _, err := s.ownArena(tx, userID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNoBusiness
			}
			return err
		}
		if err := tx.Table("arenas").Where("owner_id = ?", userID).Update("hidden", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Updates(map[string]any{
			"role":          RoleBusiness,
			"business_role": RoleBusiness,
		}).Error; err != nil {
			return err
		}
		u.Role = RoleBusiness
		u.BusinessRole = RoleBusiness
		updated = u
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

// ---- HTTP ----

// respondWithBusinessSession revokes the caller's current access token (it
// carries the old role) and answers like a login: fresh token pair + user.
func (h *UserHandler) respondWithBusinessSession(w http.ResponseWriter, r *http.Request, u *User, arena *BusinessArena) {
	if claims, ok := auth.GetClaims(r); ok && claims.ID != "" && claims.ExpiresAt != nil {
		_ = auth.Blacklist(r.Context(), h.Redis, claims.ID, time.Until(claims.ExpiresAt.Time))
	}

	token, err := auth.GenerateToken(u.ID, u.Role, h.JWTSecret)
	if err != nil {
		http.Error(w, "failed to generate token", http.StatusInternalServerError)
		return
	}
	refreshToken, err := auth.IssueRefreshToken(r.Context(), h.Redis, u.ID)
	if err != nil {
		http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"user_info": ToUserResponse(u),
		"email":     u.Email,
		"token":     token,
	}
	if arena != nil {
		resp["arena"] = arena
	}
	if isMobileClient(r) {
		resp["refresh_token"] = refreshToken
	} else {
		h.setRefreshCookie(w, refreshToken)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) OnboardBusiness(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req BusinessOnboardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	u, arena, err := h.Service.OnboardBusiness(userID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidVenueType), errors.Is(err, ErrArenaTitleRequired),
			errors.Is(err, ErrArenaTitleTooLong), errors.Is(err, ErrSportsRequired),
			errors.Is(err, ErrCityRequired):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, ErrBusinessAlreadyExists):
			http.Error(w, err.Error(), http.StatusConflict)
		case errors.Is(err, ErrBusinessRoleForbidden):
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "failed to open business account", http.StatusInternalServerError)
		}
		return
	}

	h.AuditService.Log(userID, audit.ActionRoleChange, "business:onboard", r)
	h.respondWithBusinessSession(w, r, u, arena)
}

func (h *UserHandler) GetBusiness(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, err := h.Service.GetUserByID(userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	resp := map[string]any{
		"role":          u.Role,
		"business_role": u.BusinessRole,
		"arena":         nil,
	}
	if arena, err := h.Service.GetOwnArena(userID); err == nil {
		resp["arena"] = arena
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		http.Error(w, "failed to load business account", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) DisableBusiness(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, err := h.Service.DisableBusiness(userID)
	if err != nil {
		if errors.Is(err, ErrNotBusiness) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to disable business account", http.StatusInternalServerError)
		return
	}
	h.AuditService.Log(userID, audit.ActionRoleChange, "business:disable", r)
	h.respondWithBusinessSession(w, r, u, nil)
}

func (h *UserHandler) EnableBusiness(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, err := h.Service.EnableBusiness(userID)
	if err != nil {
		switch {
		case errors.Is(err, ErrNoBusiness):
			http.Error(w, err.Error(), http.StatusNotFound)
		case errors.Is(err, ErrBusinessRoleForbidden):
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "failed to enable business account", http.StatusInternalServerError)
		}
		return
	}
	arena, _ := h.Service.GetOwnArena(userID)
	h.AuditService.Log(userID, audit.ActionRoleChange, "business:enable", r)
	h.respondWithBusinessSession(w, r, u, arena)
}
