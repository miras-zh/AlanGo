package analytics

import "time"

const (
	// Standard app & Case Operation 8-step funnel events
	EventAppInstall  = "app_install"
	EventFirstLaunch = "first_launch"
	EventFirstValue  = "first_value"
	EventCoreAction  = "core_action"
	EventPaywallView = "paywall_view"
	EventTrialStart  = "trial_start"
	EventSubscribe   = "subscribe"
	EventStoreClick  = "store_click"
	EventItemView    = "item_view"
	EventItemShare   = "item_share"
)

type Event struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	EventType  string    `gorm:"column:event_type;type:varchar(64);not null;index" json:"event_type"`
	TargetType string    `gorm:"column:target_type;type:varchar(32);default:''" json:"target_type"`
	TargetID   uint64    `gorm:"column:target_id;default:0" json:"target_id"`
	Platform   string    `gorm:"column:platform;type:varchar(32);default:''" json:"platform"`
	Source     string    `gorm:"column:source;type:varchar(64);default:''" json:"source"`
	DeviceID   string    `gorm:"column:device_id;type:varchar(128);default:''" json:"device_id"`
	IP         string    `gorm:"column:ip;type:varchar(64);default:''" json:"ip"`
	UserAgent  string    `gorm:"column:user_agent;type:text;default:''" json:"user_agent"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (Event) TableName() string {
	return "app_analytics_events"
}

type HeartbeatRequest struct {
	GuestID  string `json:"guest_id"`
	Platform string `json:"platform"` // "web" | "ios" | "android"
	Path     string `json:"path"`
}

type OnlineMeta struct {
	Platform string `json:"platform"`
	Path     string `json:"path"`
	LastSeen int64  `json:"last_seen"`
}

type OnlinePlatforms struct {
	Web     int64 `json:"web"`
	IOS     int64 `json:"ios"`
	Android int64 `json:"android"`
}

type ActiveUserRecord struct {
	ID       uint   `json:"id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Platform string `json:"platform"`
	Path     string `json:"path"`
	LastSeen int64  `json:"last_seen"`
}

type OnlineStats struct {
	Total         int64              `json:"total"`
	UsersCount    int64              `json:"users_count"`
	GuestsCount   int64              `json:"guests_count"`
	Platforms     OnlinePlatforms    `json:"platforms"`
	ActiveUserIDs []uint             `json:"active_user_ids"`
	ActiveUsers   []ActiveUserRecord `json:"active_users"`
}

type HourlyTraffic struct {
	BucketTime   time.Time `gorm:"column:bucket_time;primaryKey" json:"bucket_time"`
	PeakOnline   int       `gorm:"column:peak_online;not null;default:0" json:"peak_online"`
	UniqueUsers  int       `gorm:"column:unique_users;not null;default:0" json:"unique_users"`
	UniqueGuests int       `gorm:"column:unique_guests;not null;default:0" json:"unique_guests"`
	TotalUnique  int       `gorm:"column:total_unique;not null;default:0" json:"total_unique"`
	WebCount     int       `gorm:"column:web_count;not null;default:0" json:"web_count"`
	IOSCount     int       `gorm:"column:ios_count;not null;default:0" json:"ios_count"`
	AndroidCount int       `gorm:"column:android_count;not null;default:0" json:"android_count"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (HourlyTraffic) TableName() string {
	return "traffic_hourly_stats"
}

type TrafficPoint struct {
	Timestamp   int64  `json:"timestamp"`
	Label       string `json:"label"`
	Hour        int    `json:"hour"`
	PeakOnline  int    `json:"peak_online"`
	TotalUnique int    `json:"total_unique"`
	Users       int    `json:"users"`
	Guests      int    `json:"guests"`
	Web         int    `json:"web"`
	IOS         int    `json:"ios"`
	Android     int    `json:"android"`
}

type TrafficReport struct {
	Period        string          `json:"period"` // "24h" | "7d" | "30d"
	CurrentOnline int             `json:"current_online"`
	CurrentUsers  int             `json:"current_users"`
	CurrentGuests int             `json:"current_guests"`
	PeakOnline    int             `json:"peak_online"`
	PeakTime      string          `json:"peak_time"`
	PeakHour      int             `json:"peak_hour"`
	AvgOnline     float64         `json:"avg_online"`
	TotalVisitors int             `json:"total_visitors"`
	TotalUsers    int             `json:"total_users"`
	TotalGuests   int             `json:"total_guests"`
	Platforms     OnlinePlatforms `json:"platforms"`
	Points        []TrafficPoint  `json:"points"`
}

type FunnelSummary struct {
	AppInstall  int64 `json:"app_install"`
	FirstLaunch int64 `json:"first_launch"`
	FirstValue  int64 `json:"first_value"`
	CoreAction  int64 `json:"core_action"`
	PaywallView int64 `json:"paywall_view"`
	TrialStart  int64 `json:"trial_start"`
	Subscribe   int64 `json:"subscribe"`
	StoreClick  int64 `json:"store_click"`
}
