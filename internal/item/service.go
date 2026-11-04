package item

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"alango/internal/cache"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

var (
	ErrItemNotFound = errors.New("item not found")
	ErrForbidden    = errors.New("only the owner can modify this item")
)

const itemsCacheTTL = 2 * time.Minute

type Service struct {
	DB    *gorm.DB
	Redis *redis.Client
}

func NewService(db *gorm.DB, rdb *redis.Client) *Service {
	return &Service{DB: db, Redis: rdb}
}

func (s *Service) invalidateCache(ctx context.Context) {
	cache.InvalidatePattern(ctx, s.Redis, "items:list:*")
}

func (s *Service) Create(ctx context.Context, userID uint, req *CreateItemRequest) (*Item, error) {
	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "general"
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "active"
	}
	meta := req.Metadata
	if len(meta) == 0 || !json.Valid(meta) {
		meta = json.RawMessage(`{}`)
	}

	it := &Item{
		UserID:      userID,
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		Category:    category,
		Status:      status,
		ImageURL:    strings.TrimSpace(req.ImageURL),
		Metadata:    meta,
	}

	if err := s.DB.WithContext(ctx).Create(it).Error; err != nil {
		return nil, err
	}
	s.invalidateCache(ctx)
	return s.GetByID(ctx, it.ID)
}

func (s *Service) GetByID(ctx context.Context, id uint) (*Item, error) {
	var it Item
	err := s.DB.WithContext(ctx).Table("items i").
		Select("i.*, COALESCE(u.full_name, '') AS author_name, COALESCE(u.photo, '') AS author_photo").
		Joins("LEFT JOIN users u ON u.id = i.user_id").
		Where("i.id = ?", id).
		First(&it).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrItemNotFound
	}
	if err != nil {
		return nil, err
	}
	return &it, nil
}

func (s *Service) List(ctx context.Context, f ListFilter) (*PaginatedResponse, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize <= 0 {
		f.PageSize = 20
	}
	if f.PageSize > 100 {
		f.PageSize = 100
	}

	cacheKey := fmt.Sprintf("items:list:u=%d:cat=%s:st=%s:q=%s:p=%d:ps=%d",
		f.UserID, f.Category, f.Status, f.Search, f.Page, f.PageSize)

	var cached PaginatedResponse
	if cache.GetJSON(ctx, s.Redis, cacheKey, &cached) {
		return &cached, nil
	}

	query := s.DB.WithContext(ctx).Table("items i").
		Joins("LEFT JOIN users u ON u.id = i.user_id")

	if f.UserID > 0 {
		query = query.Where("i.user_id = ?", f.UserID)
	}
	if f.Category != "" {
		query = query.Where("i.category = ?", f.Category)
	}
	if f.Status != "" {
		query = query.Where("i.status = ?", f.Status)
	}
	if f.Search != "" {
		like := "%" + escapeLike(f.Search) + "%"
		query = query.Where("i.title ILIKE ? OR i.description ILIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	items := []Item{}
	err := query.
		Select("i.*, COALESCE(u.full_name, '') AS author_name, COALESCE(u.photo, '') AS author_photo").
		Order("i.created_at DESC, i.id DESC").
		Limit(f.PageSize).
		Offset((f.Page - 1) * f.PageSize).
		Find(&items).Error
	if err != nil {
		return nil, err
	}

	resp := &PaginatedResponse{
		Items:    items,
		Total:    total,
		Page:     f.Page,
		PageSize: f.PageSize,
	}
	cache.SetJSON(ctx, s.Redis, cacheKey, resp, itemsCacheTTL)
	return resp, nil
}

func (s *Service) Update(ctx context.Context, id, userID uint, req *UpdateItemRequest) (*Item, string, error) {
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if existing.UserID != userID {
		return nil, "", ErrForbidden
	}

	oldImage := existing.ImageURL
	updates := map[string]any{
		"updated_at": time.Now(),
	}
	if req.Title != nil {
		updates["title"] = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.Category != nil {
		updates["category"] = strings.TrimSpace(*req.Category)
	}
	if req.Status != nil {
		updates["status"] = strings.TrimSpace(*req.Status)
	}
	if req.ImageURL != nil {
		updates["image_url"] = strings.TrimSpace(*req.ImageURL)
	}
	if req.Metadata != nil && json.Valid(*req.Metadata) {
		updates["metadata"] = *req.Metadata
	}

	if err := s.DB.WithContext(ctx).Model(&Item{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, "", err
	}

	s.invalidateCache(ctx)
	updated, err := s.GetByID(ctx, id)
	return updated, oldImage, err
}

func (s *Service) Delete(ctx context.Context, id, userID uint) (string, error) {
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return "", err
	}
	if existing.UserID != userID {
		return "", ErrForbidden
	}

	if err := s.DB.WithContext(ctx).Delete(&Item{}, id).Error; err != nil {
		return "", err
	}
	s.invalidateCache(ctx)
	return existing.ImageURL, nil
}

func escapeLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`)
	return r.Replace(s)
}
