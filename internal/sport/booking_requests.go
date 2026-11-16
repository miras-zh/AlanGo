package sport

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Booking requests.
//
// A client's booking is created as "pending": the slot is held at once so
// nobody else can take it, and the arena owner confirms it, rejects it with a
// reason or moves it to another time. Bookings the owner adds himself
// ("manual") are confirmed right away. Rejected and cancelled bookings free
// their slot.

// MaxBookingDaysAhead is how far ahead a slot can be booked (today included).
const MaxBookingDaysAhead = 60

const maxRejectReasonLen = 500

var (
	ErrTooFarAhead          = fmt.Errorf("бронировать можно не дальше чем на %d дней вперёд", MaxBookingDaysAhead)
	ErrInvalidStatus        = errors.New("недопустимый статус бронирования")
	ErrStatusTransition     = errors.New("эту бронь уже нельзя перевести в такой статус")
	ErrRejectReasonRequired = errors.New("укажите причину отклонения")
	ErrBookingClosed        = errors.New("отменённую или отклонённую бронь нельзя изменить")
	ErrInvalidPaidAmount    = errors.New("сумма оплаты должна быть от 0 до стоимости брони")
)

// Notifier delivers in-app notifications (implemented by notification.Service).
type Notifier interface {
	Create(userID uint, actorID *uint, notifType, title, body string, entityID *uint, broadcast bool) error
}

// SetNotifier enables booking notifications to owners and clients.
func (s *Service) SetNotifier(n Notifier) { s.notifier = n }

func (s *Service) notify(userID *uint, actorID *uint, notifType, title, body string, bookingID uint) {
	if s.notifier == nil || userID == nil || *userID == 0 {
		return
	}
	if actorID != nil && *actorID == *userID {
		return // no notification about your own action
	}
	id := bookingID
	_ = s.notifier.Create(*userID, actorID, notifType, title, body, &id, true)
}

// isClosedStatus: the booking no longer holds its slot.
func isClosedStatus(status string) bool { return status == "cancelled" || status == "rejected" }

// statusTransitions lists where a booking may go from each status.
var statusTransitions = map[string]map[string]bool{
	"pending":   {"confirmed": true, "rejected": true, "cancelled": true},
	"confirmed": {"cancelled": true, "completed": true},
}

func canTransition(from, to string) bool { return statusTransitions[from][to] }

// checkHorizon rejects dates past the booking window.
func checkHorizon(day, now time.Time) error {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, venueTZ)
	if !day.Before(today.AddDate(0, 0, MaxBookingDaysAhead)) {
		return ErrTooFarAhead
	}
	return nil
}

// validateSlot checks a start/end range of the hall on day against its
// schedule, the clock and other active bookings (excludeID is skipped, so a
// booking being moved does not collide with itself). Run inside a
// transaction holding the hall row lock.
func (s *Service) validateSlot(tx *gorm.DB, hall Hall, day time.Time, start, end int, excludeID uint) error {
	now := time.Now().In(venueTZ)
	if err := checkHorizon(day, now); err != nil {
		return err
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
	if !day.Add(time.Duration(start) * time.Minute).After(now) {
		return ErrSlotInPast
	}
	busy, err := s.activeIntervals(tx, hall.ID, day.Format("2006-01-02"), excludeID)
	if err != nil {
		return err
	}
	for _, b := range busy {
		if overlaps(interval{start, end}, b) {
			return ErrSlotTaken
		}
	}
	return nil
}

func bookingSummary(b *Booking) string {
	return fmt.Sprintf("%s · %s, %s", b.HallTitle, ruDate(b.BookingDate), b.TimeSlot)
}

var ruMonthsGen = []string{"января", "февраля", "марта", "апреля", "мая", "июня",
	"июля", "августа", "сентября", "октября", "ноября", "декабря"}

// ruDate: "2026-12-05" → "5 декабря".
func ruDate(v string) string {
	d, err := parseDate(v)
	if err != nil {
		return v
	}
	return fmt.Sprintf("%d %s", d.Day(), ruMonthsGen[d.Month()-1])
}

// UpdateBookingStatus moves a booking along pending → confirmed / rejected /
// cancelled, confirmed → cancelled / completed, and tells the client.
func (s *Service) UpdateBookingStatus(ctx context.Context, id uint, status, reason string, actorID *uint) (*Booking, error) {
	status = strings.TrimSpace(status)
	reason = strings.TrimSpace(reason)
	switch status {
	case "confirmed", "rejected", "cancelled", "completed":
	default:
		return nil, ErrInvalidStatus
	}
	if status == "rejected" && reason == "" {
		return nil, ErrRejectReasonRequired
	}
	if len([]rune(reason)) > maxRejectReasonLen {
		reason = string([]rune(reason)[:maxRejectReasonLen])
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var b Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).Take(&b).Error; err != nil {
			return err
		}
		if b.Status == status {
			return nil
		}
		if !canTransition(b.Status, status) {
			return ErrStatusTransition
		}
		now := time.Now()
		updates := map[string]interface{}{"status": status, "status_changed_at": now, "updated_at": now}
		if status == "rejected" {
			updates["rejection_reason"] = reason
		}
		return tx.Model(&Booking{}).Where("id = ?", id).Updates(updates).Error
	})
	if err != nil {
		return nil, err
	}
	b, err := s.GetBookingByID(ctx, id)
	if err != nil {
		return nil, err
	}
	switch status {
	case "confirmed":
		s.notify(b.UserID, actorID, "booking_confirmed", "Бронь подтверждена",
			fmt.Sprintf("%s — %s. Ждём вас!", b.ArenaTitle, bookingSummary(b)), b.ID)
	case "rejected":
		s.notify(b.UserID, actorID, "booking_rejected", "Заявка отклонена",
			fmt.Sprintf("%s — %s. Причина: %s", b.ArenaTitle, bookingSummary(b), reason), b.ID)
	case "cancelled":
		s.notify(b.UserID, actorID, "booking_cancelled", "Бронь отменена",
			fmt.Sprintf("%s — %s", b.ArenaTitle, bookingSummary(b)), b.ID)
	}
	return b, nil
}

// RescheduleBooking moves an active booking to another date/time/duration of
// the same hall. The new slot is validated like a new booking (the booking
// itself does not count as busy) and the price is recalculated. The owner
// agrees the new time with the client, so a pending request becomes confirmed.
func (s *Service) RescheduleBooking(ctx context.Context, id uint, req RescheduleBookingRequest, actorID *uint) (*Booking, error) {
	day, err := parseDate(req.BookingDate)
	if err != nil {
		return nil, err
	}
	start, err := parseClock(req.StartTime)
	if err != nil {
		return nil, err
	}
	var oldSummary string
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var b Booking
		if err := tx.Where("id = ?", id).Take(&b).Error; err != nil {
			return err
		}
		if isClosedStatus(b.Status) || b.Status == "completed" {
			return ErrBookingClosed
		}
		var hall Hall
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", b.HallID).Take(&hall).Error; err != nil {
			return err
		}
		duration := req.DurationMinutes
		if duration <= 0 {
			duration = b.DurationMinutes
		}
		end := start + duration
		if err := s.validateSlot(tx, hall, day, start, end, b.ID); err != nil {
			return err
		}
		oldSummary = fmt.Sprintf("%s, %s", ruDate(b.BookingDate), b.TimeSlot)
		now := time.Now()
		updates := map[string]interface{}{
			"booking_date":     day.Format("2006-01-02"),
			"start_time":       formatClock(start),
			"end_time":         formatClock(end),
			"time_slot":        formatClock(start) + " - " + formatClock(end),
			"duration_minutes": duration,
			"total_price":      hall.PricePerHour * duration / 60,
			"updated_at":       now,
		}
		if b.Status == "pending" {
			updates["status"] = "confirmed"
			updates["status_changed_at"] = now
		}
		return tx.Model(&Booking{}).Where("id = ?", id).Updates(updates).Error
	})
	if err != nil {
		return nil, err
	}
	b, err := s.GetBookingByID(ctx, id)
	if err != nil {
		return nil, err
	}
	s.notify(b.UserID, actorID, "booking_rescheduled", "Бронь перенесена",
		fmt.Sprintf("%s — %s. Было: %s", b.ArenaTitle, bookingSummary(b), oldSummary), b.ID)
	return b, nil
}

// paymentStatusFor derives the payment status from the amount received.
func paymentStatusFor(paid, total int) string {
	switch {
	case paid <= 0:
		return "not_paid"
	case paid >= total:
		return "paid"
	default:
		return "partial"
	}
}

// UpdateBookingPayment records how much the client has paid (0..total price).
func (s *Service) UpdateBookingPayment(ctx context.Context, id uint, paid int) (*Booking, error) {
	var b Booking
	if err := s.db.WithContext(ctx).Where("id = ?", id).Take(&b).Error; err != nil {
		return nil, err
	}
	if paid < 0 || paid > b.TotalPrice {
		return nil, ErrInvalidPaidAmount
	}
	if err := s.db.WithContext(ctx).Model(&Booking{}).Where("id = ?", id).Updates(map[string]interface{}{
		"paid_amount":    paid,
		"payment_status": paymentStatusFor(paid, b.TotalPrice),
		"updated_at":     time.Now(),
	}).Error; err != nil {
		return nil, err
	}
	return s.GetBookingByID(ctx, id)
}

// UpdateBookingDetails edits the client name, phone and notes of a booking.
func (s *Service) UpdateBookingDetails(ctx context.Context, id uint, req UpdateBookingDetailsRequest) (*Booking, error) {
	updates := map[string]interface{}{"updated_at": time.Now()}
	if req.ClientName != nil {
		name := strings.TrimSpace(*req.ClientName)
		if name == "" {
			return nil, errors.New("укажите имя клиента")
		}
		updates["client_name"] = name
	}
	if req.ClientPhone != nil {
		phone := strings.TrimSpace(*req.ClientPhone)
		if len(digitsRe.FindAllString(phone, -1)) < 10 {
			return nil, ErrInvalidClientPhone
		}
		updates["client_phone"] = phone
	}
	if req.Notes != nil {
		updates["notes"] = strings.TrimSpace(*req.Notes)
	}
	if err := s.db.WithContext(ctx).Model(&Booking{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetBookingByID(ctx, id)
}

// PendingBookingsCount: requests of the arena still waiting for an answer
// (past ones are not counted — they can no longer be confirmed meaningfully).
func (s *Service) PendingBookingsCount(ctx context.Context, arenaID uint) (int64, error) {
	today := time.Now().In(venueTZ).Format("2006-01-02")
	var n int64
	err := s.db.WithContext(ctx).Model(&Booking{}).
		Where("arena_id = ? AND status = 'pending' AND booking_date >= ?", arenaID, today).
		Count(&n).Error
	return n, err
}
