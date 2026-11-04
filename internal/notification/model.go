package notification

import "time"

type Notification struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      uint      `gorm:"column:user_id;not null" json:"user_id"`
	ActorID     *uint     `gorm:"column:actor_id" json:"-"`
	Type        string    `gorm:"type:varchar(50);not null" json:"type"`
	Title       string    `gorm:"type:varchar(255);not null" json:"title"`
	Body        string    `gorm:"type:text;not null" json:"body"`
	EntityID    *uint     `gorm:"column:entity_id" json:"entity_id"`
	Read        bool      `gorm:"default:false;not null" json:"read"`
	CreatedAt   time.Time `gorm:"default:now()" json:"created_at"`
	ActorAvatar string    `gorm:"->;column:actor_avatar" json:"actor_avatar,omitempty"`
	ActorName   string    `gorm:"->;column:actor_name" json:"actor_name,omitempty"`
}

func (Notification) TableName() string { return "notifications" }
