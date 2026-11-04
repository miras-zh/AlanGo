package item

import (
	"encoding/json"
	"time"
)

// Item is the universal CRUD domain entity included in the skeleton.
// When starting a new app, you can either use Item directly (e.g. for tasks,
// timers, notes, listings, habits, workouts) or duplicate internal/item into
// internal/<your_domain> as a ready-to-go template.
type Item struct {
	ID          uint            `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      uint            `gorm:"column:user_id;not null;index" json:"user_id"`
	Title       string          `gorm:"column:title;type:varchar(255);not null" json:"title"`
	Description string          `gorm:"column:description;type:text;not null;default:''" json:"description"`
	Category    string          `gorm:"column:category;type:varchar(100);not null;default:'general'" json:"category"`
	Status      string          `gorm:"column:status;type:varchar(50);not null;default:'active'" json:"status"`
	ImageURL    string          `gorm:"column:image_url;type:text;not null;default:''" json:"image_url"`
	Metadata    json.RawMessage `gorm:"column:metadata;type:jsonb;not null;default:'{}'" json:"metadata" swaggertype:"object"`
	CreatedAt   time.Time       `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt   time.Time       `gorm:"column:updated_at;default:now()" json:"updated_at"`
	AuthorName  string          `gorm:"->;column:author_name" json:"author_name,omitempty"`
	AuthorPhoto string          `gorm:"->;column:author_photo" json:"author_photo,omitempty"`
}

func (Item) TableName() string {
	return "items"
}
