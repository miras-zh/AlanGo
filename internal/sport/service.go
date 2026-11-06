package sport

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"strings"

	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// ============================================================================
// ARENAS
// ============================================================================

func (s *Service) ListArenas(ctx context.Context, q, city, district, sport string) ([]Arena, error) {
	tx := s.db.WithContext(ctx).Model(&Arena{})

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
		like := "%" + strings.ToLower(q) + "%"
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
		Select("halls.*, arenas.title as arena_title, arenas.address as arena_address").
		Joins("JOIN arenas ON arenas.id = halls.arena_id")

	if arenaID > 0 {
		tx = tx.Where("halls.arena_id = ?", arenaID)
	}
	if sport != "" && sport != "Все" {
		tx = tx.Where("LOWER(halls.sport_type) = ?", strings.ToLower(sport))
	}
	if q != "" {
		like := "%" + strings.ToLower(q) + "%"
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
		Select("halls.*, arenas.title as arena_title, arenas.address as arena_address").
		Joins("JOIN arenas ON arenas.id = halls.arena_id").
		Where("halls.id = ?", id).
		First(&hall).Error
	if err != nil {
		return nil, err
	}
	return &hall, nil
}

func (s *Service) SaveHall(ctx context.Context, hall *Hall) error {
	if hall.ID == 0 {
		return s.db.WithContext(ctx).Create(hall).Error
	}
	return s.db.WithContext(ctx).Save(hall).Error
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

func (s *Service) CreateBooking(ctx context.Context, req CreateBookingRequest, userID *uint) (*Booking, error) {
	if req.HallID == 0 || req.ArenaID == 0 {
		return nil, errors.New("hall_id and arena_id are required")
	}
	if req.ClientName == "" || req.ClientPhone == "" {
		return nil, errors.New("client_name and client_phone are required")
	}
	if req.BookingDate == "" || req.TimeSlot == "" {
		return nil, errors.New("booking_date and time_slot are required")
	}

	// Check collision & insert atomically within a transaction to avoid race conditions
	var createdID uint
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing Booking
		collisionErr := tx.
			Where("hall_id = ? AND booking_date = ? AND time_slot = ? AND status <> 'cancelled'", req.HallID, req.BookingDate, req.TimeSlot).
			First(&existing).Error
		if collisionErr == nil {
			return errors.New("этот слот времени уже забронирован другим клиентом")
		} else if !errors.Is(collisionErr, gorm.ErrRecordNotFound) {
			return collisionErr
		}

		code := fmt.Sprintf("SR-%03d", rand.Intn(900)+100)
		booking := Booking{
			BookingCode:     code,
			HallID:          req.HallID,
			ArenaID:         req.ArenaID,
			UserID:          userID,
			ClientName:      req.ClientName,
			ClientPhone:     req.ClientPhone,
			BookingDate:     req.BookingDate,
			TimeSlot:        req.TimeSlot,
			DurationMinutes: req.DurationMinutes,
			TotalPrice:      req.TotalPrice,
			Status:          "confirmed",
			PaymentStatus:   "pending",
			Notes:           req.Notes,
		}

		if booking.DurationMinutes == 0 {
			booking.DurationMinutes = 60
		}

		parts := strings.Split(req.TimeSlot, "-")
		if len(parts) == 2 {
			booking.StartTime = strings.TrimSpace(parts[0])
			booking.EndTime = strings.TrimSpace(parts[1])
		}

		if err := tx.Create(&booking).Error; err != nil {
			return err
		}
		createdID = booking.ID
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Fetch full booking with joins
	return s.GetBookingByID(ctx, createdID)
}

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

func (s *Service) ListBookings(ctx context.Context, arenaID, hallID uint, date, status string, userID *uint) ([]Booking, error) {
	tx := s.db.WithContext(ctx).
		Table("bookings").
		Select("bookings.*, halls.title as hall_title, halls.sport_type as sport_type, arenas.title as arena_title").
		Joins("JOIN halls ON halls.id = bookings.hall_id").
		Joins("JOIN arenas ON arenas.id = bookings.arena_id")

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

	var bookings []Booking
	if err := tx.Order("bookings.created_at DESC").Find(&bookings).Error; err != nil {
		return nil, err
	}
	return bookings, nil
}

func (s *Service) UpdateBookingStatus(ctx context.Context, id uint, status string) (*Booking, error) {
	validStatuses := map[string]bool{
		"confirmed": true,
		"pending":   true,
		"cancelled": true,
		"completed": true,
	}
	if !validStatuses[status] {
		return nil, errors.New("недопустимый статус бронирования")
	}

	var booking Booking
	if err := s.db.WithContext(ctx).First(&booking, id).Error; err != nil {
		return nil, err
	}

	booking.Status = status
	if err := s.db.WithContext(ctx).Save(&booking).Error; err != nil {
		return nil, err
	}

	return s.GetBookingByID(ctx, id)
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

	var totalRevenue int64
	_ = s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("arena_id = ? AND status = 'confirmed'", arenaID).
		Select("COALESCE(SUM(total_price), 0)").
		Scan(&totalRevenue).Error

	var totalBookings int64
	_ = s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("arena_id = ?", arenaID).
		Count(&totalBookings).Error

	return &BusinessDashboard{
		Arena:          arena,
		TodayRevenue:   int(totalRevenue),
		TotalBookings:  int(totalBookings),
		HallsCount:     arena.HallsCount,
		RecentBookings: bookings,
	}, nil
}
