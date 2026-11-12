package sport

import (
	"time"

	"github.com/lib/pq"
)

type Arena struct {
	ID              uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID         *uint          `gorm:"column:owner_id;index" json:"owner_id,omitempty"`
	OwnerEmail      string         `gorm:"column:owner_email;type:varchar(255);not null;default:''" json:"owner_email"`
	Title           string         `gorm:"column:title;type:varchar(255);not null" json:"title"`
	Category        string         `gorm:"column:category;type:varchar(100);not null;default:'Спорткомплекс'" json:"category"`
	District        string         `gorm:"column:district;type:varchar(100);not null;default:''" json:"district"`
	City            string         `gorm:"column:city;type:varchar(100);not null;default:'Астана'" json:"city"`
	Address         string         `gorm:"column:address;type:varchar(255);not null" json:"address"`
	Phone           string         `gorm:"column:phone;type:varchar(50);not null;default:''" json:"phone"`
	Rating          float64        `gorm:"column:rating;type:numeric(3,2);not null;default:4.8" json:"rating"`
	ReviewsCount    int            `gorm:"column:reviews_count;not null;default:0" json:"reviews_count"`
	ImageURL        string         `gorm:"column:image_url;type:text;not null;default:''" json:"image_url"`
	Description     string         `gorm:"column:description;type:text;not null;default:''" json:"description"`
	Features        pq.StringArray `gorm:"column:features;type:text[];not null;default:'{}'" json:"features"`
	WorkingHours    string         `gorm:"column:working_hours;type:varchar(100);not null;default:'08:00 - 23:00 (ежедневно)'" json:"working_hours"`
	HallsCount      int            `gorm:"column:halls_count;not null;default:0" json:"halls_count"`
	MinPricePerHour int            `gorm:"column:min_price_per_hour;not null;default:12000" json:"min_price_per_hour"`
	Sports          pq.StringArray `gorm:"column:sports;type:text[];not null;default:'{}'" json:"sports"`
	VenueType       string         `gorm:"column:venue_type;type:varchar(32);not null;default:'complex'" json:"venue_type"`
	Hidden          bool           `gorm:"column:hidden;not null;default:false" json:"hidden"`
	CreatedAt       time.Time      `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"column:updated_at;default:now()" json:"updated_at"`

	Halls []Hall `gorm:"foreignKey:ArenaID" json:"halls,omitempty"`
}

func (Arena) TableName() string {
	return "arenas"
}

type Hall struct {
	ID           uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	ArenaID      uint           `gorm:"column:arena_id;not null;index" json:"arena_id"`
	ArenaTitle   string         `gorm:"->;column:arena_title" json:"arena_title,omitempty"`
	ArenaAddress string         `gorm:"->;column:arena_address" json:"arena_address,omitempty"`
	Title        string         `gorm:"column:title;type:varchar(255);not null" json:"title"`
	SportType    string         `gorm:"column:sport_type;type:varchar(100);not null;index" json:"sport_type"`
	SurfaceType  string         `gorm:"column:surface_type;type:varchar(255);not null;default:''" json:"surface_type"`
	Equipment    pq.StringArray `gorm:"column:equipment;type:text[];not null;default:'{}'" json:"equipment"`
	Capacity     string         `gorm:"column:capacity;type:varchar(100);not null;default:''" json:"capacity"`
	PricePerHour int            `gorm:"column:price_per_hour;not null;default:12000" json:"price_per_hour"`
	ImageURL     string         `gorm:"column:image_url;type:text;not null;default:''" json:"image_url"`
	Photos       pq.StringArray `gorm:"column:photos;type:text[];not null;default:'{}'" json:"photos"`
	LengthM      int            `gorm:"column:length_m;not null;default:0" json:"length_m"`
	WidthM       int            `gorm:"column:width_m;not null;default:0" json:"width_m"`
	MaxPeople    int            `gorm:"column:max_people;not null;default:0" json:"max_people"`
	Status       string         `gorm:"column:status;type:varchar(50);not null;default:'active'" json:"status"`
	Description  string         `gorm:"column:description;type:text;not null;default:''" json:"description"`
	Rating       float64        `gorm:"column:rating;type:numeric(3,2);not null;default:4.8" json:"rating"`
	ReviewsCount int            `gorm:"column:reviews_count;not null;default:0" json:"reviews_count"`
	CreatedAt    time.Time      `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"column:updated_at;default:now()" json:"updated_at"`
}

func (Hall) TableName() string {
	return "halls"
}

type ScheduleDay struct {
	ID            uint          `gorm:"primaryKey;autoIncrement" json:"id"`
	ArenaID       uint          `gorm:"column:arena_id;not null;index" json:"arena_id"`
	DayOfWeek     int           `gorm:"column:day_of_week;not null" json:"day_of_week"`
	DayName       string        `gorm:"column:day_name;type:varchar(50);not null" json:"day_name"`
	IsClosed      bool          `gorm:"column:is_closed;not null;default:false" json:"is_closed"`
	StartTime     string        `gorm:"column:start_time;type:varchar(10);not null;default:'08:00'" json:"start_time"`
	EndTime       string        `gorm:"column:end_time;type:varchar(10);not null;default:'23:00'" json:"end_time"`
	SlotDurations pq.Int64Array `gorm:"column:slot_durations;type:integer[];not null;default:'{60, 90}'" json:"slot_durations"`
	CreatedAt     time.Time     `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt     time.Time     `gorm:"column:updated_at;default:now()" json:"updated_at"`
}

func (ScheduleDay) TableName() string {
	return "arena_schedules"
}

type Booking struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	BookingCode     string    `gorm:"column:booking_code;type:varchar(50);not null;unique" json:"booking_code"`
	HallID          uint      `gorm:"column:hall_id;not null;index" json:"hall_id"`
	HallTitle       string    `gorm:"->;column:hall_title" json:"hall_title,omitempty"`
	SportType       string    `gorm:"->;column:sport_type" json:"sport_type,omitempty"`
	ArenaID         uint      `gorm:"column:arena_id;not null;index" json:"arena_id"`
	ArenaTitle      string    `gorm:"->;column:arena_title" json:"arena_title,omitempty"`
	UserID          *uint     `gorm:"column:user_id;index" json:"user_id,omitempty"`
	ClientName      string    `gorm:"column:client_name;type:varchar(255);not null" json:"client_name"`
	ClientPhone     string    `gorm:"column:client_phone;type:varchar(50);not null" json:"client_phone"`
	BookingDate     string    `gorm:"column:booking_date;type:varchar(50);not null" json:"booking_date"`
	TimeSlot        string    `gorm:"column:time_slot;type:varchar(50);not null" json:"time_slot"`
	StartTime       string    `gorm:"column:start_time;type:varchar(10);not null;default:'19:00'" json:"start_time"`
	EndTime         string    `gorm:"column:end_time;type:varchar(10);not null;default:'20:00'" json:"end_time"`
	DurationMinutes int       `gorm:"column:duration_minutes;not null;default:60" json:"duration_minutes"`
	TotalPrice      int       `gorm:"column:total_price;not null;default:0" json:"total_price"`
	Status          string    `gorm:"column:status;type:varchar(50);not null;default:'confirmed'" json:"status"`
	PaymentStatus   string    `gorm:"column:payment_status;type:varchar(50);not null;default:'pending'" json:"payment_status"`
	Notes           string    `gorm:"column:notes;type:text;not null;default:''" json:"notes"`
	CreatedAt       time.Time `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at;default:now()" json:"updated_at"`
}

func (Booking) TableName() string {
	return "bookings"
}

// Request and DTO types
type CreateBookingRequest struct {
	HallID          uint   `json:"hall_id"`
	ArenaID         uint   `json:"arena_id"`
	ClientName      string `json:"client_name"`
	ClientPhone     string `json:"client_phone"`
	BookingDate     string `json:"booking_date"`
	TimeSlot        string `json:"time_slot"`  // "19:00 - 20:30" (legacy)
	StartTime       string `json:"start_time"` // "19:00"
	DurationMinutes int    `json:"duration_minutes"`
	TotalPrice      int    `json:"total_price"`
	Notes           string `json:"notes"`
}

type UpdateBookingStatusRequest struct {
	Status string `json:"status"` // confirmed, pending, cancelled, completed
}

type SaveScheduleRequest struct {
	Schedule []ScheduleDay `json:"schedule"`
}

type BusinessDashboard struct {
	Arena          *Arena    `json:"arena"`
	TodayRevenue   int       `json:"today_revenue"`
	TotalBookings  int       `json:"total_bookings"`
	HallsCount     int       `json:"halls_count"`
	RecentBookings []Booking `json:"recent_bookings"`
}
