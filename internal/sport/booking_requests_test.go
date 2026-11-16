package sport

import (
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
