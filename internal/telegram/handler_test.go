package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"alango/internal/auth"
)

type stubArenaLookup struct {
	title string
	err   error
}

func (s stubArenaLookup) OwnArenaTitle(ctx context.Context, userID uint) (string, error) {
	return s.title, s.err
}

func TestNotifyBookingOwnershipAndSpoofProtection(t *testing.T) {
	bot := &BotService{}

	// Unauthenticated request (no userID in context) -> 401.
	hNoOwner := NewHandler(bot, stubArenaLookup{title: "Real Arena"})
	req := httptest.NewRequest(http.MethodPost, "/api/business/telegram/notify", bytes.NewBufferString(`{}`))
	rec := httptest.NewRecorder()
	hNoOwner.NotifyBooking(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("without user context: got %d, want 401", rec.Code)
	}

	// Authenticated business user without owned arena -> 403.
	hForbidden := NewHandler(bot, stubArenaLookup{err: errors.New("no arena")})
	reqForbidden := httptest.NewRequest(http.MethodPost, "/api/business/telegram/notify", bytes.NewBufferString(`{"arena_name":"Spoofed"}`))
	reqForbidden = reqForbidden.WithContext(context.WithValue(reqForbidden.Context(), auth.UserIDKey, uint(42)))
	recForbidden := httptest.NewRecorder()
	hForbidden.NotifyBooking(recForbidden, reqForbidden)
	if recForbidden.Code != http.StatusForbidden {
		t.Fatalf("without owned arena: got %d, want 403", recForbidden.Code)
	}

	// Authenticated arena owner: arena_name is overwritten by server lookup.
	reqOK := httptest.NewRequest(http.MethodPost, "/api/business/telegram/notify", bytes.NewBufferString(`{"arena_name":"Spoofed Arena","client_name":"Test"}`))
	reqOK = reqOK.WithContext(context.WithValue(reqOK.Context(), auth.UserIDKey, uint(7)))
	recOK := httptest.NewRecorder()
	hNoOwner.NotifyBooking(recOK, reqOK)
	if recOK.Code != http.StatusOK {
		t.Fatalf("owner notify: got %d, want 200", recOK.Code)
	}
	var resp struct {
		Alert BookingAlert `json:"alert"`
	}
	if err := json.Unmarshal(recOK.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Alert.ArenaName != "Real Arena" {
		t.Fatalf("expected server-derived arena_name 'Real Arena', got %q", resp.Alert.ArenaName)
	}
}
