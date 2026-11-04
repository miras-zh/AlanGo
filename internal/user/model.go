package user

import "time"

type User struct {
	ID                 uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FullName           string     `gorm:"column:full_name;type:varchar(255)" json:"full_name"`
	Email              string     `gorm:"uniqueIndex;type:varchar(255);not null" json:"email"`
	Phone              string     `gorm:"column:phone;type:varchar(50)" json:"phone"`
	PhoneVerified      bool       `gorm:"column:phone_verified;not null;default:false" json:"phone_verified"`
	City               string     `gorm:"column:city;type:varchar(100)" json:"city"`
	Photo              string     `gorm:"column:photo;type:text" json:"photo"`
	PushToken          string     `gorm:"column:push_token;type:varchar(255)" json:"-"`
	Password           string     `gorm:"type:text;not null" json:"-"`
	GoogleSub          *string    `gorm:"column:google_sub" json:"-"`
	AppleSub           *string    `gorm:"column:apple_sub" json:"-"`
	AppleRefreshToken  *string    `gorm:"column:apple_refresh_token" json:"-"`
	Role               string     `gorm:"default:'client'" json:"role"`
	BusinessRole       string     `gorm:"column:business_role;default:''" json:"business_role"`
	Type               string     `gorm:"column:type;default:'user'" json:"type"`
	Plan               string     `gorm:"column:plan;default:'standard'" json:"plan"`
	PlanExpiresAt      *time.Time `gorm:"column:plan_expires_at" json:"plan_expires_at,omitempty"`
	Active             bool       `gorm:"column:active;not null;default:true" json:"active"`
	CreatedAt          time.Time  `gorm:"default:now()" json:"created_at"`
}

func (User) TableName() string {
	return "users"
}
