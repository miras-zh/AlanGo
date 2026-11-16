package sport

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Integration test of the booking request flow against a real Postgres with
// all migrations applied. Runs only when ALANGO_TEST_DSN is set, e.g.
// ALANGO_TEST_DSN="host=127.0.0.1 port=55432 user=postgres dbname=alango_test sslmode=disable".

type sentNotification struct {
	userID uint
	typ    string
	body   string
}

type fakeNotifier struct{ sent []sentNotification }

func (f *fakeNotifier) Create(userID uint, _ *uint, typ, _, body string, _ *uint, _ bool) error {
	f.sent = append(f.sent, sentNotification{userID, typ, body})
	return nil
}

func (f *fakeNotifier) last() sentNotification {
	if len(f.sent) == 0 {
		return sentNotification{}
	}
	return f.sent[len(f.sent)-1]
}

func TestBookingRequestFlowDB(t *testing.T) {
	dsn := os.Getenv("ALANGO_TEST_DSN")
	if dsn == "" {
		t.Skip("ALANGO_TEST_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	notifier := &fakeNotifier{}
	s := NewService(db)
	s.SetNotifier(notifier)

	// Owner and client accounts; the owner takes arena 1 (hall 101).
	var ownerID, clientID uint
	db.Raw(`INSERT INTO users (full_name, email, role) VALUES ('Owner', 'owner-test@example.com', 'business') RETURNING id`).Scan(&ownerID)
	db.Raw(`INSERT INTO users (full_name, email) VALUES ('Client', 'client-test@example.com') RETURNING id`).Scan(&clientID)
	db.Exec(`UPDATE arenas SET owner_id = ? WHERE id = 1`, ownerID)
	db.Exec(`DELETE FROM bookings WHERE hall_id = 101`)
	t.Cleanup(func() {
		db.Exec(`DELETE FROM bookings WHERE hall_id = 101`)
		db.Exec(`UPDATE arenas SET owner_id = NULL WHERE id = 1`)
		db.Exec(`DELETE FROM users WHERE id IN (?, ?)`, ownerID, clientID)
	})

	// A working day a few days ahead with at least three free slots.
	var date string
	var av *Availability
	for i := 2; i < 10; i++ {
		d := time.Now().In(venueTZ).AddDate(0, 0, i).Format("2006-01-02")
		a, err := s.HallAvailability(ctx, 101, d, 0)
		if err != nil {
			t.Fatal(err)
		}
		if !a.IsClosed && len(a.Slots) >= 4 {
			date, av = d, a
			break
		}
	}
	if av == nil {
		t.Fatal("no open day for hall 101")
	}
	dur := av.DurationMinutes
	slot := func(i int) string { return av.Slots[i].Start }
	req := func(start string) CreateBookingRequest {
		return CreateBookingRequest{HallID: 101, ClientName: "Client", ClientPhone: "+7 701 000 00 00",
			BookingDate: date, StartTime: start, DurationMinutes: dur}
	}

	// 1. A client's booking is a pending request; the owner is notified.
	b1, err := s.CreateBooking(ctx, req(slot(0)), &clientID)
	if err != nil {
		t.Fatal(err)
	}
	if b1.Status != "pending" || b1.PaymentStatus != "not_paid" {
		t.Fatalf("client booking: status %s payment %s", b1.Status, b1.PaymentStatus)
	}
	if n := notifier.last(); n.userID != ownerID || n.typ != "booking_request" {
		t.Fatalf("owner not notified: %+v", n)
	}

	// 2. The pending request holds the slot.
	if _, err := s.CreateBooking(ctx, req(slot(0)), nil); !errors.Is(err, ErrSlotTaken) {
		t.Fatalf("second booking of a pending slot: %v", err)
	}
	a, _ := s.HallAvailability(ctx, 101, date, dur)
	if a.Slots[0].Status != "booked" {
		t.Fatalf("pending slot shown as %s", a.Slots[0].Status)
	}

	// 3. The owner's own booking is confirmed at once, no self-notification.
	sentBefore := len(notifier.sent)
	b2, err := s.CreateBooking(ctx, req(slot(2)), &ownerID)
	if err != nil {
		t.Fatal(err)
	}
	if b2.Status != "confirmed" || len(notifier.sent) != sentBefore {
		t.Fatalf("owner booking: status %s, notifications %d→%d", b2.Status, sentBefore, len(notifier.sent))
	}

	// 4. Booking window: 60 days ahead is refused.
	far := req(slot(0))
	far.BookingDate = time.Now().In(venueTZ).AddDate(0, 0, MaxBookingDaysAhead).Format("2006-01-02")
	if _, err := s.CreateBooking(ctx, far, &clientID); !errors.Is(err, ErrTooFarAhead) {
		t.Fatalf("60 days ahead: %v", err)
	}

	// 5. Pending count for the owner's arena.
	if n, _ := s.PendingBookingsCount(ctx, 1); n != 1 {
		t.Fatalf("pending count %d, want 1", n)
	}

	// 6. Reschedule onto a taken slot fails; onto a free one confirms and moves it.
	if _, err := s.RescheduleBooking(ctx, b1.ID, RescheduleBookingRequest{BookingDate: date, StartTime: slot(2)}, &ownerID); !errors.Is(err, ErrSlotTaken) {
		t.Fatalf("reschedule onto taken slot: %v", err)
	}
	moved, err := s.RescheduleBooking(ctx, b1.ID, RescheduleBookingRequest{BookingDate: date, StartTime: slot(1)}, &ownerID)
	if err != nil {
		t.Fatal(err)
	}
	if moved.Status != "confirmed" || moved.StartTime != slot(1) || moved.DurationMinutes != dur {
		t.Fatalf("moved: %+v", moved)
	}
	if n := notifier.last(); n.userID != clientID || n.typ != "booking_rescheduled" {
		t.Fatalf("client not notified of reschedule: %+v", n)
	}
	if n, _ := s.PendingBookingsCount(ctx, 1); n != 0 {
		t.Fatalf("pending count after reschedule %d, want 0", n)
	}
	// The old slot is free again.
	if _, err := s.CreateBooking(ctx, req(slot(0)), &clientID); err != nil {
		t.Fatalf("old slot not freed: %v", err)
	}

	// 7. Reject needs a reason, frees the slot and tells the client.
	b3, _ := s.CreateBooking(ctx, req(slot(3)), &clientID)
	if _, err := s.UpdateBookingStatus(ctx, b3.ID, "rejected", "  ", &ownerID); !errors.Is(err, ErrRejectReasonRequired) {
		t.Fatalf("reject without reason: %v", err)
	}
	rej, err := s.UpdateBookingStatus(ctx, b3.ID, "rejected", "Зал на ремонте", &ownerID)
	if err != nil {
		t.Fatal(err)
	}
	if rej.Status != "rejected" || rej.RejectionReason != "Зал на ремонте" || rej.StatusChangedAt == nil {
		t.Fatalf("rejected: %+v", rej)
	}
	if n := notifier.last(); n.userID != clientID || n.typ != "booking_rejected" {
		t.Fatalf("client not notified of rejection: %+v", n)
	}
	if _, err := s.CreateBooking(ctx, req(slot(3)), nil); err != nil {
		t.Fatalf("rejected slot not freed: %v", err)
	}

	// 8. Closed bookings stay closed.
	if _, err := s.UpdateBookingStatus(ctx, b3.ID, "confirmed", "", &ownerID); !errors.Is(err, ErrStatusTransition) {
		t.Fatalf("rejected → confirmed: %v", err)
	}
	if _, err := s.RescheduleBooking(ctx, b3.ID, RescheduleBookingRequest{BookingDate: date, StartTime: slot(3)}, &ownerID); !errors.Is(err, ErrBookingClosed) {
		t.Fatalf("reschedule rejected: %v", err)
	}
	if _, err := s.UpdateBookingStatus(ctx, b2.ID, "bogus", "", &ownerID); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("bogus status: %v", err)
	}

	// 9. Payment is stored on the server.
	paid, err := s.UpdateBookingPayment(ctx, b2.ID, 3000)
	if err != nil {
		t.Fatal(err)
	}
	if paid.PaidAmount != 3000 || paid.PaymentStatus != "partial" {
		t.Fatalf("payment: %d %s", paid.PaidAmount, paid.PaymentStatus)
	}
	if _, err := s.UpdateBookingPayment(ctx, b2.ID, b2.TotalPrice+1); !errors.Is(err, ErrInvalidPaidAmount) {
		t.Fatalf("overpay: %v", err)
	}

	// 10. Details edit.
	name, phone := "Новое имя", "+7 777 111 22 33"
	ed, err := s.UpdateBookingDetails(ctx, b2.ID, UpdateBookingDetailsRequest{ClientName: &name, ClientPhone: &phone})
	if err != nil || ed.ClientName != name || ed.ClientPhone != phone {
		t.Fatalf("details: %v %+v", err, ed)
	}
	bad := "123"
	if _, err := s.UpdateBookingDetails(ctx, b2.ID, UpdateBookingDetailsRequest{ClientPhone: &bad}); !errors.Is(err, ErrInvalidClientPhone) {
		t.Fatalf("bad phone: %v", err)
	}
}
