package auth

import (
	"testing"
)

func TestGenerateAndValidateToken(t *testing.T) {
	secret := "test-secret-that-is-at-least-32-chars-long"
	tok, err := GenerateToken(42, "client", secret)
	if err != nil {
		t.Fatalf("GenerateToken error: %v", err)
	}

	claims, err := ValidateToken(tok, secret, "")
	if err != nil {
		t.Fatalf("ValidateToken error: %v", err)
	}
	if claims.UserID != 42 {
		t.Fatalf("expected user_id=42, got %d", claims.UserID)
	}
	if claims.Role != "client" {
		t.Fatalf("expected role=client, got %s", claims.Role)
	}
	if claims.ID == "" {
		t.Fatalf("expected non-empty jti")
	}

	// Secret rotation: validate with new secret + previousSecret = old secret
	newSecret := "new-secret-that-is-at-least-32-characters-long"
	claimsRot, err := ValidateToken(tok, newSecret, secret)
	if err != nil || claimsRot.UserID != 42 {
		t.Fatalf("expected rotation fallback to succeed, got err=%v", err)
	}
}
