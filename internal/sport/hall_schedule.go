package sport

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Per-hall weekly schedule and slot availability.
//
// A hall's own schedule (hall_schedules) wins; a hall without one falls back
// to its arena's schedule (arena_schedules), then to the default week. Slots
// start every SlotStepMinutes inside the working hours; a slot of a given
// duration is free when it fits the hours, is not in the past and does not
// overlap any non-cancelled booking of the same hall.

const SlotStepMinutes = 60

// Kazakhstan is on a single UTC+5 zone; the server may run in UTC.
var venueTZ = time.FixedZone("KZ", 5*60*60)

var dayNames = []string{"Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"}

var (
	ErrInvalidDate        = errors.New("дата должна быть в формате ГГГГ-ММ-ДД")
	ErrInvalidTime        = errors.New("время должно быть в формате ЧЧ:ММ")
	ErrInvalidDuration    = errors.New("недопустимая длительность брони")
	ErrHallClosed         = errors.New("в этот день зал не работает")
	ErrOutsideHours       = errors.New("время вне графика работы зала")
	ErrSlotInPast         = errors.New("это время уже прошло")
	ErrSlotTaken          = errors.New("это время уже забронировано, выберите другой слот")
	ErrHallNotBookable    = errors.New("зал сейчас недоступен для бронирования")
	ErrInvalidClientPhone = errors.New("укажите корректный номер телефона")
)

type HallScheduleDay struct {
	ID            uint          `gorm:"primaryKey;autoIncrement" json:"id"`
	HallID        uint          `gorm:"column:hall_id;not null;index" json:"hall_id"`
	DayOfWeek     int           `gorm:"column:day_of_week;not null" json:"day_of_week"`
	DayName       string        `gorm:"column:day_name;type:varchar(50);not null;default:''" json:"day_name"`
	IsClosed      bool          `gorm:"column:is_closed;not null;default:false" json:"is_closed"`
	StartTime     string        `gorm:"column:start_time;type:varchar(10);not null;default:'08:00'" json:"start_time"`
	EndTime       string        `gorm:"column:end_time;type:varchar(10);not null;default:'23:00'" json:"end_time"`
	SlotDurations pq.Int64Array `gorm:"column:slot_durations;type:integer[];not null;default:'{60, 90}'" json:"slot_durations"`
	CreatedAt     time.Time     `gorm:"column:created_at;default:now()" json:"created_at"`
	UpdatedAt     time.Time     `gorm:"column:updated_at;default:now()" json:"updated_at"`
}

func (HallScheduleDay) TableName() string { return "hall_schedules" }

type SaveHallScheduleRequest struct {
	Schedule []HallScheduleDay `json:"schedule"`
}

type Slot struct {
	Start  string `json:"start"`  // "19:00"
	End    string `json:"end"`    // "20:30"
	Label  string `json:"label"`  // "19:00 - 20:30"
	Status string `json:"status"` // free | booked | closed | past
}

type Availability struct {
	HallID          uint    `json:"hall_id"`
	Date            string  `json:"date"`
	DayOfWeek       int     `json:"day_of_week"`
	IsClosed        bool    `json:"is_closed"`
	StartTime       string  `json:"start_time"`
	EndTime         string  `json:"end_time"`
	DurationMinutes int     `json:"duration_minutes"`
	SlotDurations   []int64 `json:"slot_durations"`
	PricePerHour    int     `json:"price_per_hour"`
	Price           int     `json:"price"`
	Slots           []Slot  `json:"slots"`
}

func defaultWeek(hallID uint) []HallScheduleDay {
	week := make([]HallScheduleDay, 0, 7)
	for d := 0; d < 7; d++ {
		week = append(week, HallScheduleDay{
			HallID: hallID, DayOfWeek: d, DayName: dayNames[d],
			StartTime: "08:00", EndTime: "23:00", SlotDurations: pq.Int64Array{60, 90},
		})
	}
	return week
}

// GetHallSchedule returns 7 days (Sunday..Saturday) for the hall.
func (s *Service) GetHallSchedule(ctx context.Context, hallID uint) ([]HallScheduleDay, error) {
	return s.hallSchedule(s.db.WithContext(ctx), hallID)
}

func (s *Service) hallSchedule(db *gorm.DB, hallID uint) ([]HallScheduleDay, error) {
	var own []HallScheduleDay
	if err := db.Where("hall_id = ?", hallID).Order("day_of_week ASC").Find(&own).Error; err != nil {
		return nil, err
	}

	week := defaultWeek(hallID)
	// Template from the arena for days the hall has not configured.
	var hall Hall
	if err := db.Select("id, arena_id").Where("id = ?", hallID).Take(&hall).Error; err == nil {
		var arenaDays []ScheduleDay
		if err := db.Where("arena_id = ?", hall.ArenaID).Find(&arenaDays).Error; err == nil {
			for _, a := range arenaDays {
				if a.DayOfWeek >= 0 && a.DayOfWeek < 7 {
					week[a.DayOfWeek].IsClosed = a.IsClosed
					week[a.DayOfWeek].StartTime = a.StartTime
					week[a.DayOfWeek].EndTime = a.EndTime
					week[a.DayOfWeek].SlotDurations = a.SlotDurations
				}
			}
		}
	}
	for _, d := range own {
		if d.DayOfWeek >= 0 && d.DayOfWeek < 7 {
			week[d.DayOfWeek] = d
		}
	}
	for i := range week {
		if week[i].DayName == "" {
			week[i].DayName = dayNames[i]
		}
		if len(week[i].SlotDurations) == 0 {
			week[i].SlotDurations = pq.Int64Array{60}
		}
	}
	return week, nil
}

func validateScheduleDay(d *HallScheduleDay) error {
	if d.DayOfWeek < 0 || d.DayOfWeek > 6 {
		return fmt.Errorf("day_of_week must be 0..6")
	}
	if d.IsClosed {
		return nil
	}
	start, err := parseClock(d.StartTime)
	if err != nil {
		return err
	}
	end, err := parseClock(d.EndTime)
	if err != nil {
		return err
	}
	if end <= start {
		return fmt.Errorf("%s: время окончания должно быть позже начала", dayNames[d.DayOfWeek])
	}
	durations := pq.Int64Array{}
	for _, m := range d.SlotDurations {
		if m >= 30 && m <= 360 && m%30 == 0 {
			durations = append(durations, m)
		}
	}
	if len(durations) == 0 {
		durations = pq.Int64Array{60}
	}
	sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })
	d.SlotDurations = durations
	return nil
}

// SaveHallSchedule upserts the given days of the hall's schedule.
func (s *Service) SaveHallSchedule(ctx context.Context, hallID uint, days []HallScheduleDay) error {
	for i := range days {
		days[i].HallID = hallID
		if err := validateScheduleDay(&days[i]); err != nil {
			return err
		}
		if days[i].DayName == "" {
			days[i].DayName = dayNames[days[i].DayOfWeek]
		}
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, d := range days {
			row := HallScheduleDay{
				HallID: hallID, DayOfWeek: d.DayOfWeek, DayName: d.DayName, IsClosed: d.IsClosed,
				StartTime: d.StartTime, EndTime: d.EndTime, SlotDurations: d.SlotDurations,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "hall_id"}, {Name: "day_of_week"}},
				DoUpdates: clause.Assignments(map[string]interface{}{"day_name": row.DayName, "is_closed": row.IsClosed, "start_time": row.StartTime, "end_time": row.EndTime, "slot_durations": row.SlotDurations, "updated_at": time.Now()}),
			}).Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// --- time helpers ---

var clockRe = regexp.MustCompile(`^(\d{1,2}):(\d{2})$`)

// parseClock converts "HH:MM" to minutes since midnight; "24:00" is allowed as end of day.
func parseClock(v string) (int, error) {
	m := clockRe.FindStringSubmatch(strings.TrimSpace(v))
	if m == nil {
		return 0, ErrInvalidTime
	}
	h, _ := strconv.Atoi(m[1])
	mi, _ := strconv.Atoi(m[2])
	if h > 24 || mi > 59 || (h == 24 && mi != 0) {
		return 0, ErrInvalidTime
	}
	return h*60 + mi, nil
}

func formatClock(minutes int) string {
	return fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}

func parseDate(v string) (time.Time, error) {
	t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(v), venueTZ)
	if err != nil {
		return time.Time{}, ErrInvalidDate
	}
	return t, nil
}

type interval struct{ start, end int }

// bookingInterval reads a booking's minutes range from start/end time or the
// "HH:MM - HH:MM" time slot (legacy rows).
func bookingInterval(b Booking) (interval, bool) {
	start, err1 := parseClock(b.StartTime)
	end, err2 := parseClock(b.EndTime)
	if err1 != nil || err2 != nil || end <= start {
		parts := strings.Split(b.TimeSlot, "-")
		if len(parts) != 2 {
			return interval{}, false
		}
		var err error
		if start, err = parseClock(parts[0]); err != nil {
			return interval{}, false
		}
		if end, err = parseClock(parts[1]); err != nil || end <= start {
			return interval{}, false
		}
	}
	return interval{start, end}, true
}

func overlaps(a, b interval) bool { return a.start < b.end && b.start < a.end }

func (s *Service) activeIntervals(db *gorm.DB, hallID uint, date string) ([]interval, error) {
	var bookings []Booking
	if err := db.Table("bookings").
		Where("hall_id = ? AND booking_date = ? AND status <> 'cancelled'", hallID, date).
		Find(&bookings).Error; err != nil {
		return nil, err
	}
	out := make([]interval, 0, len(bookings))
	for _, b := range bookings {
		if iv, ok := bookingInterval(b); ok {
			out = append(out, iv)
		}
	}
	return out, nil
}

func durationAllowed(day HallScheduleDay, minutes int) bool {
	for _, d := range day.SlotDurations {
		if int(d) == minutes {
			return true
		}
	}
	return false
}

// HallAvailability lists the day's slots for the given duration with their status.
func (s *Service) HallAvailability(ctx context.Context, hallID uint, date string, duration int) (*Availability, error) {
	db := s.db.WithContext(ctx)
	hall, err := s.GetHallByID(ctx, hallID)
	if err != nil {
		return nil, err
	}
	day, err := parseDate(date)
	if err != nil {
		return nil, err
	}
	week, err := s.hallSchedule(db, hallID)
	if err != nil {
		return nil, err
	}
	sched := week[int(day.Weekday())]
	if duration <= 0 || !durationAllowed(sched, duration) {
		duration = int(sched.SlotDurations[0])
	}

	res := &Availability{
		HallID: hallID, Date: day.Format("2006-01-02"), DayOfWeek: int(day.Weekday()),
		IsClosed: sched.IsClosed, StartTime: sched.StartTime, EndTime: sched.EndTime,
		DurationMinutes: duration, SlotDurations: sched.SlotDurations,
		PricePerHour: hall.PricePerHour, Price: hall.PricePerHour * duration / 60,
		Slots: []Slot{},
	}
	if sched.IsClosed {
		return res, nil
	}
	open, err1 := parseClock(sched.StartTime)
	close, err2 := parseClock(sched.EndTime)
	if err1 != nil || err2 != nil || close <= open {
		res.IsClosed = true
		return res, nil
	}

	busy, err := s.activeIntervals(db, hallID, res.Date)
	if err != nil {
		return nil, err
	}

	now := time.Now().In(venueTZ)
	isToday := now.Format("2006-01-02") == res.Date
	nowMin := now.Hour()*60 + now.Minute()
	inPastDay := day.Before(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, venueTZ))

	for start := open; start+SlotStepMinutes <= close; start += SlotStepMinutes {
		end := start + duration
		slot := Slot{Start: formatClock(start), End: formatClock(end)}
		slot.Label = slot.Start + " - " + slot.End
		iv := interval{start, end}
		switch {
		case inPastDay || (isToday && start <= nowMin):
			slot.Status = "past"
		case end > close:
			slot.Status = "closed"
		default:
			slot.Status = "free"
			for _, b := range busy {
				if overlaps(iv, b) {
					slot.Status = "booked"
					break
				}
			}
		}
		res.Slots = append(res.Slots, slot)
	}
	return res, nil
}

// --- booking ---

var digitsRe = regexp.MustCompile(`\d`)

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func newBookingCode() string {
	b := make([]byte, 6)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(codeAlphabet))))
		if err != nil {
			b[i] = codeAlphabet[i]
			continue
		}
		b[i] = codeAlphabet[n.Int64()]
	}
	return "AG-" + string(b)
}

// bookingRange resolves start/end minutes and duration from the request
// (start_time + duration_minutes, or a "HH:MM - HH:MM" time_slot).
func bookingRange(req CreateBookingRequest) (int, int, error) {
	startStr := strings.TrimSpace(req.StartTime)
	endStr := ""
	if parts := strings.Split(req.TimeSlot, "-"); startStr == "" && len(parts) == 2 {
		startStr, endStr = strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
	}
	start, err := parseClock(startStr)
	if err != nil {
		return 0, 0, err
	}
	duration := req.DurationMinutes
	if duration <= 0 && endStr != "" {
		end, err := parseClock(endStr)
		if err != nil {
			return 0, 0, err
		}
		duration = end - start
	}
	if duration <= 0 {
		return 0, 0, ErrInvalidDuration
	}
	return start, start + duration, nil
}

// CreateBooking validates the slot against the hall's schedule and existing
// bookings and inserts it. The hall row is locked for the duration of the
// transaction so two clients cannot take overlapping time concurrently.
// Arena and price are derived on the server.
func (s *Service) CreateBooking(ctx context.Context, req CreateBookingRequest, userID *uint) (*Booking, error) {
	if req.HallID == 0 {
		return nil, errors.New("hall_id is required")
	}
	req.ClientName = strings.TrimSpace(req.ClientName)
	req.ClientPhone = strings.TrimSpace(req.ClientPhone)
	if req.ClientName == "" {
		return nil, errors.New("укажите имя клиента")
	}
	if len(digitsRe.FindAllString(req.ClientPhone, -1)) < 10 {
		return nil, ErrInvalidClientPhone
	}
	day, err := parseDate(req.BookingDate)
	if err != nil {
		return nil, err
	}
	date := day.Format("2006-01-02")
	start, end, err := bookingRange(req)
	if err != nil {
		return nil, err
	}

	var createdID uint
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var hall Hall
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", req.HallID).Take(&hall).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("зал не найден")
			}
			return err
		}
		var arena Arena
		if err := tx.Select("id, hidden").Where("id = ?", hall.ArenaID).Take(&arena).Error; err != nil {
			return err
		}
		if hall.Status != "active" || arena.Hidden {
			return ErrHallNotBookable
		}

		week, err := s.hallSchedule(tx, hall.ID)
		if err != nil {
			return err
		}
		sched := week[int(day.Weekday())]
		if sched.IsClosed {
			return ErrHallClosed
		}
		if !durationAllowed(sched, end-start) {
			return ErrInvalidDuration
		}
		open, err1 := parseClock(sched.StartTime)
		close, err2 := parseClock(sched.EndTime)
		if err1 != nil || err2 != nil || start < open || end > close {
			return ErrOutsideHours
		}
		now := time.Now().In(venueTZ)
		startAt := day.Add(time.Duration(start) * time.Minute)
		if !startAt.After(now) {
			return ErrSlotInPast
		}

		busy, err := s.activeIntervals(tx, hall.ID, date)
		if err != nil {
			return err
		}
		for _, b := range busy {
			if overlaps(interval{start, end}, b) {
				return ErrSlotTaken
			}
		}

		booking := Booking{
			BookingCode:     newBookingCode(),
			HallID:          hall.ID,
			ArenaID:         hall.ArenaID,
			UserID:          userID,
			ClientName:      req.ClientName,
			ClientPhone:     req.ClientPhone,
			BookingDate:     date,
			StartTime:       formatClock(start),
			EndTime:         formatClock(end),
			TimeSlot:        formatClock(start) + " - " + formatClock(end),
			DurationMinutes: end - start,
			TotalPrice:      hall.PricePerHour * (end - start) / 60,
			Status:          "confirmed",
			PaymentStatus:   "pending",
			Notes:           strings.TrimSpace(req.Notes),
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
	return s.GetBookingByID(ctx, createdID)
}
