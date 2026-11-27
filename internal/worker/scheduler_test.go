package worker

import (
	"context"
	"testing"
)

func TestSchedulerNilDBNoOp(t *testing.T) {
	s := NewScheduler(nil)
	if err := s.CheckExpiredSubscriptions(context.Background()); err != nil {
		t.Fatalf("expected nil error on nil DB, got %v", err)
	}
	if err := s.CleanupExpiredTokens(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := s.CleanupOldRecords(context.Background()); err != nil {
		t.Fatalf("expected nil error on nil DB for CleanupOldRecords, got %v", err)
	}
	if err := s.SendUpcomingBookingReminders(context.Background()); err != nil {
		t.Fatalf("expected nil error on nil DB for SendUpcomingBookingReminders, got %v", err)
	}
	if err := s.SendDueBusinessReminders(context.Background()); err != nil {
		t.Fatalf("expected nil error on nil DB for SendDueBusinessReminders, got %v", err)
	}
	if err := s.SendRetentionReminders(context.Background()); err != nil {
		t.Fatalf("expected nil error on nil DB for SendRetentionReminders, got %v", err)
	}
}
