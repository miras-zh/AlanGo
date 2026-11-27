package config

import (
	"os"
	"path/filepath"
	"testing"
)

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

	t.Setenv("COOKIE_SECURE", "true")
	t.Setenv("METRICS_PASSWORD", "dev-metrics-password")
	prodCfg, err := NewConfig()
	if err != nil {
		t.Fatalf("NewConfig prod failed: %v", err)
	}
	if prodCfg.MetricsPassword != "" {
		t.Fatalf("expected empty MetricsPassword in production when dev default is set, got %q", prodCfg.MetricsPassword)
	}

	t.Setenv("METRICS_PASSWORD", "custom-prod-secret")
	prodCustom, err := NewConfig()
	if err != nil {
		t.Fatalf("NewConfig prod custom failed: %v", err)
	}
	if prodCustom.MetricsPassword != "custom-prod-secret" {
		t.Fatalf("expected custom MetricsPassword, got %q", prodCustom.MetricsPassword)
	}
}

func TestResolveFirebaseServiceAccountPath(t *testing.T) {
	if got := resolveFirebaseServiceAccountPath(" /custom/key.json ", t.TempDir()); got != "/custom/key.json" {
		t.Fatalf("expected explicit path override, got %q", got)
	}

	root := t.TempDir()
	cfgDir := filepath.Join(root, "config")
	if err := os.MkdirAll(cfgDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	keyPath := filepath.Join(cfgDir, "alango-27ee7-firebase-adminsdk-fbsvc-test.json")
	if err := os.WriteFile(keyPath, []byte(`{}`), 0o600); err != nil {
		t.Fatalf("write key: %v", err)
	}

	got := resolveFirebaseServiceAccountPath("", cfgDir, root)
	if got != keyPath {
		t.Fatalf("expected auto-discovered path %q, got %q", keyPath, got)
	}
}
