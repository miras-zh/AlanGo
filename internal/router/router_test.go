package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"alango/config"
)

func TestRouterSecurityAndHeaders(t *testing.T) {
	cfg := &config.Config{
		SiteName:               "AlanGo",
		SiteURL:                "http://localhost:3002",
		JWTSecret:              "test-secret-that-is-at-least-32-chars-long",
		CORSAllowedOrigin:      "https://app.example.com",
		UploadDir:              t.TempDir(),
		UploadPublicURL:        "http://localhost:8092/uploads",
		MetricsPassword:        "secret-pass",
		RateLimitMax:           120,
		LoginRateLimitMax:      20,
		PasswordResetRateLimitMax: 5,
		PublicFormRateLimitMax: 10,
		TrustedProxies:         "127.0.0.0/8",
	}

	h := NewRouter(nil, nil, cfg)

	// Admin, analytics, and telegram routes must require authentication (401 without token).
	protectedPaths := []struct {
		method string
		path   string
	}{
		{"GET", "/api/admin/subscription-requests"},
		{"POST", "/api/admin/subscription-requests/1/approve"},
		{"GET", "/api/admin/analytics/funnel"},
		{"GET", "/api/admin/analytics/online"},
		{"GET", "/api/admin/analytics/traffic"},
		{"POST", "/api/business/telegram/notify"},
		{"GET", "/api/business/telegram/status"},
	}
	for _, tc := range protectedPaths {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without auth: got %d, want 401", tc.method, tc.path, rec.Code)
		}
	}

	// Old public analytics/telegram paths must no longer be exposed (404/405).
	for _, path := range []string{"/api/analytics/funnel", "/api/analytics/online", "/api/analytics/traffic"} {
		req := httptest.NewRequest("GET", path, nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code == http.StatusOK {
			t.Errorf("old public analytics path %s unexpectedly returned 200", path)
		}
	}

	// CORS + Security headers check on /healthz.
	req := httptest.NewRequest("GET", "/healthz", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("/healthz: got %d, want 200", rec.Code)
	}
	if rec.Header().Get("Vary") != "Origin" {
		t.Errorf("expected Vary: Origin header, got %q", rec.Header().Get("Vary"))
	}
	if rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("expected X-Frame-Options: DENY, got %q", rec.Header().Get("X-Frame-Options"))
	}

	// Metrics auth check.
	mReq := httptest.NewRequest("GET", "/metrics", nil)
	mRec := httptest.NewRecorder()
	h.ServeHTTP(mRec, mReq)
	if mRec.Code != http.StatusUnauthorized {
		t.Errorf("/metrics without auth: got %d, want 401", mRec.Code)
	}
}
