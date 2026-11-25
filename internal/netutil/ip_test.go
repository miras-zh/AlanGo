package netutil

import (
	"net/http/httptest"
	"testing"
)

func TestTrustedProxyCheckerClientIP(t *testing.T) {
	c := NewTrustedProxyChecker("127.0.0.0/8,172.16.0.0/12")

	// Direct untrusted client: X-Forwarded-For must be ignored (anti-spoofing).
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "203.0.113.50:43210"
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	if got := c.ClientIP(req); got != "203.0.113.50" {
		t.Fatalf("untrusted peer: got %q, want 203.0.113.50", got)
	}

	// Trusted proxy peer: rightmost untrusted IP in X-Forwarded-For wins.
	req2 := httptest.NewRequest("GET", "/", nil)
	req2.RemoteAddr = "172.18.0.2:8080"
	req2.Header.Set("X-Forwarded-For", "9.9.9.9, 198.51.100.77, 172.18.0.1")
	if got := c.ClientIP(req2); got != "198.51.100.77" {
		t.Fatalf("trusted proxy: got %q, want 198.51.100.77", got)
	}

	// Trusted proxy with X-Real-IP fallback.
	req3 := httptest.NewRequest("GET", "/", nil)
	req3.RemoteAddr = "127.0.0.1:50000"
	req3.Header.Set("X-Real-IP", "198.51.100.88")
	if got := c.ClientIP(req3); got != "198.51.100.88" {
		t.Fatalf("x-real-ip fallback: got %q, want 198.51.100.88", got)
	}
}
