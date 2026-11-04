package audit

import "time"

type Entry struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Action    string    `gorm:"type:varchar(50);not null" json:"action"`
	Detail    string    `gorm:"type:text" json:"detail"`
	IP        string    `gorm:"column:ip;type:varchar(64)" json:"ip"`
	CreatedAt time.Time `gorm:"default:now()" json:"created_at"`
}

func (Entry) TableName() string { return "audit_log" }

type EntryWithUser struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"user_id"`
	Action    string    `json:"action"`
	Detail    string    `json:"detail"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"created_at"`
	UserName  string    `json:"user_name"`
	UserEmail string    `json:"user_email"`
	UserType  string    `json:"user_type"`
}

type Action string

const (
	ActionLogin                Action = "login"
	ActionLoginFailed          Action = "login_failed"
	ActionRefreshReuseDetected Action = "refresh_reuse_detected"
	ActionRegister             Action = "register"
	ActionLogout               Action = "logout"
	ActionPasswordReset        Action = "password_reset"
	ActionPlanChange           Action = "plan_change"
	ActionRoleChange           Action = "role_change"
	ActionPhoneChange          Action = "phone_change"
	ActionEmailChange          Action = "email_change"
	ActionAvatarUpload         Action = "avatar_upload"
	ActionAvatarDelete         Action = "avatar_delete"
	ActionProfileUpdate        Action = "profile_update"
	ActionAccountDisabled      Action = "account_disabled"
	ActionAccountEnabled       Action = "account_enabled"
	ActionItemCreate           Action = "item_create"
	ActionItemUpdate           Action = "item_update"
	ActionItemDelete           Action = "item_delete"
)
