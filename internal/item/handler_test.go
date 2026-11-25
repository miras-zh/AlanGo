package item

import (
	"strings"
	"testing"

	"alango/internal/upload"
)

func TestValidateCreateItem(t *testing.T) {
	uploads := upload.NewService(t.TempDir(), "http://localhost:8092/uploads")

	if msg := validateCreateItem(&CreateItemRequest{Title: ""}, uploads); msg == "" {
		t.Errorf("expected empty title error")
	}
	if msg := validateCreateItem(&CreateItemRequest{Title: strings.Repeat("x", 256)}, uploads); msg == "" {
		t.Errorf("expected oversized title error")
	}
	if msg := validateCreateItem(&CreateItemRequest{Title: "Ball", Category: strings.Repeat("c", 101)}, uploads); msg == "" {
		t.Errorf("expected oversized category error")
	}
	if msg := validateCreateItem(&CreateItemRequest{Title: "Ball", ImageURL: "http://localhost:8092/uploads/other.png"}, uploads); msg == "" {
		t.Errorf("expected foreign own-upload image_url error")
	}
	if msg := validateCreateItem(&CreateItemRequest{Title: "Ball", ImageURL: "https://cdn.example.com/ball.png"}, uploads); msg != "" {
		t.Errorf("unexpected error for valid item: %s", msg)
	}
}
