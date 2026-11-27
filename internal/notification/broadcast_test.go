package notification

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateBroadcastContent(t *testing.T) {
	if _, _, err := validateBroadcastContent("   ", "Body"); !errors.Is(err, ErrBroadcastTitleRequired) {
		t.Fatalf("expected ErrBroadcastTitleRequired, got %v", err)
	}
	if _, _, err := validateBroadcastContent("Title", "  "); !errors.Is(err, ErrBroadcastBodyRequired) {
		t.Fatalf("expected ErrBroadcastBodyRequired, got %v", err)
	}
	if _, _, err := validateBroadcastContent(strings.Repeat("a", maxBroadcastTitleRunes+1), "Body"); !errors.Is(err, ErrBroadcastTooLong) {
		t.Fatalf("expected ErrBroadcastTooLong for title, got %v", err)
	}
	title, body, err := validateBroadcastContent(" Акция ", " Скидка 20% ")
	if err != nil || title != "Акция" || body != "Скидка 20%" {
		t.Fatalf("unexpected result: title=%q body=%q err=%v", title, body, err)
	}
}
