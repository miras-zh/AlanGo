package subscription

import (
	"testing"
	"time"
)

func TestEffectivePlanAndCatalog(t *testing.T) {
	future := time.Now().Add(time.Hour)
	past := time.Now().Add(-time.Hour)

	if got := EffectivePlan("", nil); got != PlanStandard {
		t.Fatalf("empty plan: got %q, want %q", got, PlanStandard)
	}
	if got := EffectivePlan(PlanPro, &future); got != PlanPro {
		t.Fatalf("active pro plan: got %q, want %q", got, PlanPro)
	}
	if got := EffectivePlan(PlanVIP, &past); got != PlanStandard {
		t.Fatalf("expired vip plan: got %q, want %q", got, PlanStandard)
	}

	var svc *Service
	if catalog := svc.ListCatalog(); len(catalog) != 3 {
		t.Fatalf("expected 3 default plans, got %d", len(catalog))
	}
}
