package sport

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/lib/pq"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const defaultBookingsLimit = 200

func escapeLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`)
	return r.Replace(s)
}

type Service struct {
	db       *gorm.DB
	notifier Notifier
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// ============================================================================
// ARENAS
// ============================================================================

func (s *Service) ListArenas(ctx context.Context, q, city, district, sport string) ([]Arena, error) {
	// Arenas of owners who disabled their business account stay out of the catalog.
	tx := s.db.WithContext(ctx).Model(&Arena{}).Where("hidden = ?", false)

	if city != "" {
		tx = tx.Where("LOWER(city) = ?", strings.ToLower(city))
	}
	if district != "" && district != "Все" {
		tx = tx.Where("LOWER(district) = ?", strings.ToLower(district))
	}
	if sport != "" && sport != "Все" {
		tx = tx.Where("? = ANY(sports)", sport)
	}
	if q != "" {
		like := "%" + escapeLike(strings.ToLower(q)) + "%"
		tx = tx.Where("LOWER(title) LIKE ? OR LOWER(address) LIKE ? OR LOWER(description) LIKE ?", like, like, like)
	}

	var arenas []Arena
	if err := tx.Order("rating DESC, id ASC").Find(&arenas).Error; err != nil {
		return nil, err
	}

	if len(arenas) == 0 {
		return arenas, nil
	}

	// Optimized batch-fetch halls (resolves N+1 query problem)
	arenaIDs := make([]uint, len(arenas))
	arenaIndexMap := make(map[uint]int, len(arenas))
	for i, a := range arenas {
		arenaIDs[i] = a.ID
		arenaIndexMap[a.ID] = i
	}

	var allHalls []Hall
	if err := s.db.WithContext(ctx).Where("arena_id IN (?) AND status = 'active'", arenaIDs).Find(&allHalls).Error; err == nil {
		for _, h := range allHalls {
			if idx, ok := arenaIndexMap[h.ArenaID]; ok {
				arenas[idx].Halls = append(arenas[idx].Halls, h)
			}
		}
		for i := range arenas {
			arenas[i].HallsCount = len(arenas[i].Halls)
		}
	}

	return arenas, nil
}

func (s *Service) GetArenaByID(ctx context.Context, id uint) (*Arena, error) {
	var arena Arena
	if err := s.db.WithContext(ctx).Preload("Halls").First(&arena, id).Error; err != nil {
		return nil, err
	}
	return &arena, nil
}

func (s *Service) GetPublicArenaByID(ctx context.Context, id uint) (*Arena, error) {
	var arena Arena
	if err := s.db.WithContext(ctx).
		Where("hidden = ?", false).
		Preload("Halls", "status = ?", "active").
		First(&arena, id).Error; err != nil {
		return nil, err
	}
	arena.HallsCount = len(arena.Halls)
	return &arena, nil
}

func (s *Service) SaveArena(ctx context.Context, arena *Arena) error {
	if arena.ID == 0 {
		return s.db.WithContext(ctx).Create(arena).Error
	}
	return s.db.WithContext(ctx).Save(arena).Error
}

// ============================================================================
// HALLS
// ============================================================================

func (s *Service) ListHalls(ctx context.Context, sport string, arenaID uint, q string) ([]Hall, error) {
	tx := s.db.WithContext(ctx).
		Table("halls").
		Select("halls.*, arenas.title as arena_title, arenas.address as arena_address, "+scheduleConfiguredSQL).
		Joins("JOIN arenas ON arenas.id = halls.arena_id").
		Where("arenas.hidden = ?", false)

	if arenaID > 0 {
		tx = tx.Where("halls.arena_id = ?", arenaID)
	}
	if sport != "" && sport != "Все" {
		tx = tx.Where("LOWER(halls.sport_type) = ?", strings.ToLower(sport))
	}
	if q != "" {
		like := "%" + escapeLike(strings.ToLower(q)) + "%"
		tx = tx.Where("LOWER(halls.title) LIKE ? OR LOWER(arenas.title) LIKE ? OR LOWER(halls.surface_type) LIKE ?", like, like, like)
	}

	var halls []Hall
	if err := tx.Where("halls.status = 'active'").Order("halls.id ASC").Find(&halls).Error; err != nil {
		return nil, err
	}
	return halls, nil
}

func (s *Service) GetHallByID(ctx context.Context, id uint) (*Hall, error) {
	var hall Hall
	err := s.db.WithContext(ctx).
		Table("halls").
		Select("halls.*, arenas.title as arena_title, arenas.address as arena_address, "+scheduleConfiguredSQL).
		Joins("JOIN arenas ON arenas.id = halls.arena_id").
		Where("halls.id = ?", id).
		First(&hall).Error
	if err != nil {
		return nil, err
	}
	return &hall, nil
}

func (s *Service) GetPublicHallByID(ctx context.Context, id uint) (*Hall, error) {
	var hall Hall
	err := s.db.WithContext(ctx).
		Table("halls").
		Select("halls.*, arenas.title as arena_title, arenas.address as arena_address, "+scheduleConfiguredSQL).
		Joins("JOIN arenas ON arenas.id = halls.arena_id").
		Where("halls.id = ? AND halls.status = 'active' AND arenas.hidden = false", id).
		First(&hall).Error
	if err != nil {
		return nil, err
	}
	return &hall, nil
}

var ErrHallLimitReached = errors.New("hall limit reached for your subscription plan")

func hallLimitForPlan(plan string, expiresAt *time.Time) int {
	effective := plan
	if effective == "" || (expiresAt != nil && time.Now().After(*expiresAt)) {
		effective = "standard"
	}
	switch effective {
	case "vip":
		return 0 // unlimited
	case "pro":
		return 10
	default:
		return 2
	}
}

func (s *Service) CheckHallLimit(ctx context.Context, ownerID uint, arenaID uint) error {
	var userRow struct {
		Plan          string
		PlanExpiresAt *time.Time
	}
	if err := s.db.WithContext(ctx).Table("users").
		Select("plan, plan_expires_at").
		Where("id = ?", ownerID).
		Take(&userRow).Error; err != nil {
		return err
	}
	limit := hallLimitForPlan(userRow.Plan, userRow.PlanExpiresAt)
	if limit <= 0 {
		return nil
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&Hall{}).
		Where("arena_id = ?", arenaID).
		Count(&count).Error; err != nil {
		return err
	}
	if int(count) >= limit {
		return ErrHallLimitReached
	}
	return nil
}

func (s *Service) syncArenaStats(tx *gorm.DB, arenaID uint) error {
	var stats struct {
		Count    int
		MinPrice int
	}
	if err := tx.Table("halls").
		Select("COUNT(*) AS count, COALESCE(MIN(price_per_hour), 0) AS min_price").
		Where("arena_id = ? AND status = 'active'", arenaID).
		Scan(&stats).Error; err != nil {
		return err
	}
	return tx.Table("arenas").
		Where("id = ?", arenaID).
		Updates(map[string]interface{}{
			"halls_count":        stats.Count,
			"min_price_per_hour": stats.MinPrice,
			"updated_at":         time.Now(),
		}).Error
}

func (s *Service) SaveHall(ctx context.Context, hall *Hall) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if hall.ID == 0 {
			// GORM skips zero values that have a column default (rating 4.8) and
			// then reads the default back via RETURNING, so remember the intent
			// first: a new hall starts unrated.
			unrated := hall.Rating == 0
			if err := tx.Create(hall).Error; err != nil {
				return err
			}
			if unrated {
				hall.Rating = 0
				hall.ReviewsCount = 0
				if err := tx.Model(&Hall{}).Where("id = ?", hall.ID).
					Updates(map[string]interface{}{"rating": 0, "reviews_count": 0}).Error; err != nil {
					return err
				}
			}
		} else {
			if err := tx.Save(hall).Error; err != nil {
				return err
			}
		}
		return s.syncArenaStats(tx, hall.ArenaID)
	})
}

// ============================================================================
// SCHEDULES
// ============================================================================

func (s *Service) GetArenaSchedule(ctx context.Context, arenaID uint) ([]ScheduleDay, error) {
	var schedule []ScheduleDay
	err := s.db.WithContext(ctx).
		Where("arena_id = ?", arenaID).
		Order("day_of_week ASC").
		Find(&schedule).Error
	if err != nil {
		return nil, err
	}
	return schedule, nil
}

func (s *Service) SaveArenaSchedule(ctx context.Context, arenaID uint, days []ScheduleDay) error {
	for i := range days {
		durations, err := validateDayFields(days[i].DayOfWeek, days[i].IsClosed, days[i].StartTime, days[i].EndTime, days[i].SlotDurations)
		if err != nil {
			return err
		}
		days[i].SlotDurations = durations
		if days[i].DayName == "" {
			days[i].DayName = dayNames[days[i].DayOfWeek]
		}
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, day := range days {
			day.ArenaID = arenaID
			var existing ScheduleDay
			err := tx.Where("arena_id = ? AND day_of_week = ?", arenaID, day.DayOfWeek).First(&existing).Error
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					if err := tx.Create(&day).Error; err != nil {
						return err
					}
				} else {
					return err
				}
			} else {
				existing.DayName = day.DayName
				existing.IsClosed = day.IsClosed
				existing.StartTime = day.StartTime
				existing.EndTime = day.EndTime
				existing.SlotDurations = day.SlotDurations
				if err := tx.Save(&existing).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// ============================================================================
// BOOKINGS
// ============================================================================

func (s *Service) GetBookingByID(ctx context.Context, id uint) (*Booking, error) {
	var booking Booking
	err := s.db.WithContext(ctx).
		Table("bookings").
		Select("bookings.*, halls.title as hall_title, halls.sport_type as sport_type, arenas.title as arena_title").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Joins("JOIN arenas ON arenas.id = bookings.arena_id").
		Where("bookings.id = ?", id).
		First(&booking).Error
	if err != nil {
		return nil, err
	}
	return &booking, nil
}

func (s *Service) ListBookings(ctx context.Context, arenaID, hallID uint, date, status string, userID *uint, limit int) ([]Booking, error) {
	tx := s.db.WithContext(ctx).
		Table("bookings").
		Select("bookings.*, halls.title as hall_title, halls.sport_type as sport_type, arenas.title as arena_title, client_ratings.score as client_rating").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Joins("JOIN arenas ON arenas.id = bookings.arena_id").
		Joins("LEFT JOIN client_ratings ON client_ratings.booking_id = bookings.id")

	if arenaID > 0 {
		tx = tx.Where("bookings.arena_id = ?", arenaID)
	}
	if hallID > 0 {
		tx = tx.Where("bookings.hall_id = ?", hallID)
	}
	if date != "" {
		tx = tx.Where("bookings.booking_date = ?", date)
	}
	if status != "" && status != "Все" {
		tx = tx.Where("bookings.status = ?", status)
	}
	if userID != nil {
		tx = tx.Where("bookings.user_id = ?", *userID)
	}

	if limit <= 0 {
		limit = defaultBookingsLimit
	}
	tx = tx.Limit(limit)

	var bookings []Booking
	if err := tx.Order("bookings.created_at DESC").Find(&bookings).Error; err != nil {
		return nil, err
	}
	return bookings, nil
}

func (s *Service) GetBusinessDashboard(ctx context.Context, arenaID uint) (*BusinessDashboard, error) {
	arena, err := s.GetArenaByID(ctx, arenaID)
	if err != nil {
		return nil, err
	}

	var bookings []Booking
	_ = s.db.WithContext(ctx).
		Table("bookings").
		Select("bookings.*, halls.title as hall_title, arenas.title as arena_title").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Joins("JOIN arenas ON arenas.id = bookings.arena_id").
		Where("bookings.arena_id = ?", arenaID).
		Order("bookings.created_at DESC").
		Limit(10).
		Find(&bookings).Error

	today := time.Now().In(venueTZ).Format("2006-01-02")
	var todayRevenue int64
	_ = s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("arena_id = ? AND booking_date = ? AND status IN ('confirmed', 'completed')", arenaID, today).
		Select("COALESCE(SUM(total_price), 0)").
		Scan(&todayRevenue).Error

	var totalBookings int64
	_ = s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("arena_id = ?", arenaID).
		Count(&totalBookings).Error

	return &BusinessDashboard{
		Arena:          arena,
		TodayRevenue:   int(todayRevenue),
		TotalBookings:  int(totalBookings),
		HallsCount:     arena.HallsCount,
		RecentBookings: bookings,
	}, nil
}

var ErrTooManyPhotos = errors.New("a hall can have at most 5 photos")
var ErrPhotoNotFound = errors.New("photo not found in this hall")

// AddHallPhoto atomically appends a photo URL to a hall's gallery under a row lock.
func (s *Service) AddHallPhoto(ctx context.Context, hallID uint, url string) (*Hall, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var hall Hall
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", hallID).Take(&hall).Error; err != nil {
			return err
		}
		if len(hall.Photos) >= 5 {
			return ErrTooManyPhotos
		}
		photos := append(pq.StringArray{}, hall.Photos...)
		photos = append(photos, url)
		return tx.Model(&Hall{}).Where("id = ?", hallID).
			Updates(map[string]interface{}{"photos": photos, "image_url": photos[0]}).Error
	})
	if err != nil {
		return nil, err
	}
	return s.GetHallByID(ctx, hallID)
}

// RemoveHallPhoto atomically removes targetURL from the hall gallery under a row lock.
func (s *Service) RemoveHallPhoto(ctx context.Context, hallID uint, targetURL string) (*Hall, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var hall Hall
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", hallID).Take(&hall).Error; err != nil {
			return err
		}
		photos := pq.StringArray{}
		found := false
		for _, p := range hall.Photos {
			if p == targetURL && !found {
				found = true
				continue
			}
			photos = append(photos, p)
		}
		if !found {
			return ErrPhotoNotFound
		}
		cover := ""
		if len(photos) > 0 {
			cover = photos[0]
		}
		return tx.Model(&Hall{}).Where("id = ?", hallID).
			Updates(map[string]interface{}{"photos": photos, "image_url": cover}).Error
	})
	if err != nil {
		return nil, err
	}
	return s.GetHallByID(ctx, hallID)
}

// scheduleConfiguredSQL marks halls that have their own weekly schedule.
const scheduleConfiguredSQL = "EXISTS (SELECT 1 FROM hall_schedules hs WHERE hs.hall_id = halls.id) AS schedule_configured"
