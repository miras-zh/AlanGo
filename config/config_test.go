package config

import "testing"

func TestNewConfigReadsRateLimitsAndDefaults(t *testing.T) {
	t.Setenv("JWT_SECRET", "short")
	if _, err := NewConfig(); err == nil {
		t.Fatalf("expected error for short JWT_SECRET")
	}

	t.Setenv("JWT_SECRET", "test-secret-that-is-at-least-32-chars-long")
	t.Setenv("RATE_LIMIT_MAX", "250")
	t.Setenv("LOGIN_RATE_LIMIT_MAX", "15")
	t.Setenv("APPLE_BUNDLE_IDS", "")

	cfg, err := NewConfig()
	if err != nil {
		t.Fatalf("NewConfig failed: %v", err)
	}
	if cfg.RateLimitMax != 250 || cfg.LoginRateLimitMax != 15 {
		t.Fatalf("unexpected rate limits: %d, %d", cfg.RateLimitMax, cfg.LoginRateLimitMax)
	}
	if cfg.AppleBundleIDs != "kz.alango.app" {
		t.Fatalf("expected default AppleBundleIDs kz.alango.app, got %q", cfg.AppleBundleIDs)
	}
}
