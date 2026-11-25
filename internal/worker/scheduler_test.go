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
}
