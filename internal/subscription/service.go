package subscription

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	PlanStandard = "standard"
	PlanPro      = "pro"
	PlanVIP      = "vip"
)

var (
	ErrInvalidPlan  = errors.New("invalid plan")
	ErrUserNotFound = errors.New("user not found")
)

var defaultCatalog = []PlanInfo{
	{
		ID:       PlanStandard,
		Name:     "Standard",
		Price:    0,
		Features: []string{"Базовый функционал", "До 10 записей"},
	},
	{
		ID:       PlanPro,
		Name:     "Pro",
		Price:    2990,
		Features: []string{"Расширенный доступ", "Безлимитные записи", "Приоритетная поддержка"},
	},
	{
		ID:       PlanVIP,
		Name:     "VIP",
		Price:    7990,
		Features: []string{"Полный доступ ко всем функциям", "Персональные уведомления", "VIP статус"},
	},
}

func EffectivePlan(plan string, expiresAt *time.Time) string {
	if plan == "" {
		return PlanStandard
	}
	if expiresAt != nil && time.Now().After(*expiresAt) {
		return PlanStandard
	}
	return plan
}

type Service struct {
	DB *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{DB: db}
}

func (s *Service) ListCatalog() []PlanInfo {
	if s == nil || s.DB == nil {
		return defaultCatalog
	}
	var rows []Plan
	if err := s.DB.Where("active = true").Order("sort_order ASC, id ASC").Find(&rows).Error; err != nil || len(rows) == 0 {
		return defaultCatalog
	}
	out := make([]PlanInfo, 0, len(rows))
	for _, r := range rows {
		features := []string(r.Features)
		if features == nil {
			features = []string{}
		}
		out = append(out, PlanInfo{
			ID:             r.Code,
			Name:           r.Name,
			Price:          r.PriceKZT,
			PriceOnRequest: r.PriceOnRequest,
			Features:       features,
		})
	}
	return out
}

func (s *Service) Get(userID uint) (plan string, expiresAt *time.Time, err error) {
	var row struct {
		Plan          string
		PlanExpiresAt *time.Time
	}
	err = s.DB.Table("users").
		Select("plan, plan_expires_at").
		Where("id = ?", userID).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil, ErrUserNotFound
	}
	if err != nil {
		return "", nil, err
	}

	eff := EffectivePlan(row.Plan, row.PlanExpiresAt)
	if eff != row.Plan {
		_ = s.DB.Table("users").Where("id = ?", userID).
			Updates(map[string]any{"plan": eff, "plan_expires_at": nil}).Error
		return eff, nil, nil
	}
	return eff, row.PlanExpiresAt, nil
}

func (s *Service) Set(userID uint, plan string) (*time.Time, error) {
	catalog := s.ListCatalog()
	var matched *PlanInfo
	for i := range catalog {
		if catalog[i].ID == plan {
			matched = &catalog[i]
			break
		}
	}
	if matched == nil {
		return nil, ErrInvalidPlan
	}

	updates := map[string]any{"plan": plan}
	var expiresAt *time.Time
	if matched.Price == 0 && !matched.PriceOnRequest {
		updates["plan_expires_at"] = nil
	} else {
		exp := time.Now().AddDate(0, 0, 30)
		updates["plan_expires_at"] = exp
		expiresAt = &exp
	}

	res := s.DB.Table("users").Where("id = ?", userID).Updates(updates)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, ErrUserNotFound
	}
	return expiresAt, nil
}
