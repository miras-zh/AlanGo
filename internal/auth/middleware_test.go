package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthAndRoleMiddlewares(t *testing.T) {
	secret := "test-secret-that-is-at-least-32-chars-long"
	tok, err := GenerateToken(7, "client", secret)
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	okHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// AuthMiddleware rejects disabled account.
	disabledMW := AuthMiddleware(secret, "", nil, func(uint) (bool, error) { return false, nil })(okHandler)
	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	disabledMW.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("disabled account: got %d, want 403", rec.Code)
	}

	// RequireAdminType blocks regular user and allows admin.
	adminMW := AuthMiddleware(secret, "", nil, func(uint) (bool, error) { return true, nil })(
		RequireAdminType(func(uint) (string, error) { return "user", nil })(okHandler),
	)
	rec = httptest.NewRecorder()
	adminMW.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin user: got %d, want 403", rec.Code)
	}

	adminAllowMW := AuthMiddleware(secret, "", nil, func(uint) (bool, error) { return true, nil })(
		RequireAdminType(func(uint) (string, error) { return "admin", nil })(okHandler),
	)
	rec = httptest.NewRecorder()
	adminAllowMW.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("admin user: got %d, want 200", rec.Code)
	}

	// RequireRole("business") blocks client and allows business.
	bizBlockMW := AuthMiddleware(secret, "", nil, func(uint) (bool, error) { return true, nil })(
		RequireRole("business", func(uint) (string, error) { return "client", nil })(okHandler),
	)
	rec = httptest.NewRecorder()
	bizBlockMW.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("client on business route: got %d, want 403", rec.Code)
	}

	bizAllowMW := AuthMiddleware(secret, "", nil, func(uint) (bool, error) { return true, nil })(
		RequireRole("business", func(uint) (string, error) { return "business", nil })(okHandler),
	)
	rec = httptest.NewRecorder()
	bizAllowMW.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("business on business route: got %d, want 200", rec.Code)
	}
}
