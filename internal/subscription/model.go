package subscription

import (
	"time"

	"github.com/lib/pq"
)

type Plan struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Code           string         `gorm:"column:code" json:"code"`
	Name           string         `gorm:"column:name" json:"name"`
	PriceKZT       int            `gorm:"column:price_kzt" json:"price_kzt"`
	PriceOnRequest bool           `gorm:"column:price_on_request" json:"price_on_request"`
	Features       pq.StringArray `gorm:"column:features;type:text[]" json:"features"`
	SortOrder      int            `gorm:"column:sort_order" json:"sort_order"`
	Active         bool           `gorm:"column:active" json:"active"`
	IsDefault      bool           `gorm:"column:is_default" json:"is_default"`
	CreatedAt      time.Time      `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"column:updated_at" json:"updated_at"`
}

func (Plan) TableName() string { return "subscription_plans" }

type PlanInfo struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Price          int      `json:"price"`
	PriceOnRequest bool     `json:"price_on_request"`
	Features       []string `json:"features"`
}

type SubscriptionResponse struct {
	Current   string     `json:"current"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Plans     []PlanInfo `json:"plans"`
}

type ChangePlanRequest struct {
	Plan string `json:"plan"`
}
