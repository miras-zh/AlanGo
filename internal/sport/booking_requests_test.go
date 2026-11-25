package sport

import (
	"strings"
	"testing"
	"time"
)

func TestCheckHorizon(t *testing.T) {
	now := time.Date(2026, 11, 15, 22, 30, 0, 0, venueTZ)
	day := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, venueTZ) }
	cases := []struct {
		name string
		day  time.Time
		ok   bool
	}{
		{"today", day(2026, 11, 15), true},
		{"december", day(2026, 12, 20), true},
		{"last allowed day (59 days ahead)", day(2027, 1, 13), true},
		{"60 days ahead", day(2027, 1, 14), false},
		{"far future", day(2027, 6, 1), false},
	}
	for _, c := range cases {
		if err := checkHorizon(c.day, now); (err == nil) != c.ok {
			t.Errorf("%s: err=%v, want ok=%v", c.name, err, c.ok)
		}
	}
}

func TestCanTransition(t *testing.T) {
	cases := []struct {
		from, to string
		ok       bool
	}{
		{"pending", "confirmed", true},
		{"pending", "rejected", true},
		{"pending", "cancelled", true},
		{"pending", "completed", false},
		{"confirmed", "cancelled", true},
		{"confirmed", "completed", true},
		{"confirmed", "rejected", false},
		{"confirmed", "pending", false},
		{"rejected", "confirmed", false},
		{"cancelled", "confirmed", false},
		{"completed", "cancelled", false},
	}
	for _, c := range cases {
		if got := canTransition(c.from, c.to); got != c.ok {
			t.Errorf("%s → %s: got %v, want %v", c.from, c.to, got, c.ok)
		}
	}
}

func TestPaymentStatusFor(t *testing.T) {
	cases := []struct {
		paid, total int
		want        string
	}{
		{0, 10000, "not_paid"},
		{2000, 10000, "partial"},
		{10000, 10000, "paid"},
		{0, 0, "not_paid"},
	}
	for _, c := range cases {
		if got := paymentStatusFor(c.paid, c.total); got != c.want {
			t.Errorf("paid %d of %d: got %s, want %s", c.paid, c.total, got, c.want)
		}
	}
}

func TestRuDate(t *testing.T) {
	if got := ruDate("2026-12-05"); got != "5 декабря" {
		t.Errorf("got %q", got)
	}
	if got := ruDate("bad"); got != "bad" {
		t.Errorf("got %q", got)
	}
}

func TestHallLimitForPlan(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)
	if got := hallLimitForPlan("standard", nil); got != 2 {
		t.Errorf("standard limit: got %d, want 2", got)
	}
	if got := hallLimitForPlan("pro", &future); got != 10 {
		t.Errorf("active pro limit: got %d, want 10", got)
	}
	if got := hallLimitForPlan("pro", &past); got != 2 {
		t.Errorf("expired pro limit: got %d, want 2", got)
	}
	if got := hallLimitForPlan("vip", &future); got != 0 {
		t.Errorf("vip limit: got %d, want 0 (unlimited)", got)
	}
}

func TestValidateDayFields(t *testing.T) {
	if _, err := validateDayFields(7, false, "08:00", "22:00", nil); err == nil {
		t.Errorf("expected error for day_of_week=7")
	}
	if _, err := validateDayFields(1, false, "22:00", "08:00", nil); err == nil {
		t.Errorf("expected error when end <= start")
	}
	durs, err := validateDayFields(1, false, "08:00", "22:00", []int64{90, 45, 60})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(durs) != 2 || durs[0] != 60 || durs[1] != 90 {
		t.Errorf("unexpected filtered durations: %v", durs)
	}
}

func TestValidateBookingFields(t *testing.T) {
	if _, err := validateClientName(strings.Repeat("a", maxClientNameRunes+1)); err == nil {
		t.Errorf("expected error for overlong client name")
	}
	if _, _, err := validateClientPhone("+" + strings.Repeat("7", maxClientPhoneRunes)); err == nil {
		t.Errorf("expected error for overlong client phone")
	}
	if _, err := validateBookingNotes(strings.Repeat("x", maxBookingNotesRunes+1)); err == nil {
		t.Errorf("expected error for overlong notes")
	}
	name, err := validateClientName("  Алихан  ")
	if err != nil || name != "Алихан" {
		t.Errorf("unexpected client name result: %q, %v", name, err)
	}
	phone, tail, err := validateClientPhone("+7 (777) 123-45-67")
	if err != nil || phone == "" || tail != "7771234567" {
		t.Errorf("unexpected client phone result: %q, %q, %v", phone, tail, err)
	}
}
