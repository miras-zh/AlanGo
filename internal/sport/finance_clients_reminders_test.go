package sport

import (
	"testing"
	"time"
)

func TestDeriveClientSegment(t *testing.T) {
	if got := deriveClientSegment("blocked", 100000, 10); got != "blocked" {
		t.Fatalf("expected override 'blocked', got %q", got)
	}
	if got := deriveClientSegment("", 45000, 1); got != "vip" {
		t.Fatalf("expected auto 'vip' for >40k spent, got %q", got)
	}
	if got := deriveClientSegment("", 12000, 5); got != "vip" {
		t.Fatalf("expected auto 'vip' for >=5 bookings, got %q", got)
	}
	if got := deriveClientSegment("", 20000, 2); got != "regular" {
		t.Fatalf("expected auto 'regular' for 2 bookings, got %q", got)
	}
	if got := deriveClientSegment("", 10000, 1); got != "new" {
		t.Fatalf("expected auto 'new' for 1 booking, got %q", got)
	}
}

func TestPeriodBoundsAndExpenseCategory(t *testing.T) {
	if !validExpenseCategory("salary") || !validExpenseCategory("utilities") || validExpenseCategory("unknown") {
		t.Fatal("expense category validation mismatch")
	}
	now := time.Now().In(venueTZ)
	norm, _, _, _, days := periodBounds("today", now)
	if norm != "today" || days != 1 {
		t.Fatalf("unexpected today bounds: norm=%s days=%d", norm, days)
	}
	norm, _, _, _, days = periodBounds("invalid", now)
	if norm != "month" || days != 30 {
		t.Fatalf("unexpected fallback bounds: norm=%s days=%d", norm, days)
	}
}
