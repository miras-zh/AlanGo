package telegram

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"alango/internal/auth"
)

type ArenaOwnershipLookup interface {
	OwnArenaTitle(ctx context.Context, userID uint) (string, error)
}

type Handler struct {
	botService *BotService
	ownership  ArenaOwnershipLookup
}

func NewHandler(bot *BotService, ownership ArenaOwnershipLookup) *Handler {
	return &Handler{botService: bot, ownership: ownership}
}

func truncateString(s string, max int) string {
	s = strings.TrimSpace(s)
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max])
	}
	return s
}

func (h *Handler) NotifyBooking(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	if h.ownership == nil {
		http.Error(w, `{"error":"arena ownership verification unavailable"}`, http.StatusForbidden)
		return
	}
	arenaTitle, err := h.ownership.OwnArenaTitle(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"you do not own an active arena"}`, http.StatusForbidden)
		return
	}

	var alert BookingAlert
	if err := json.NewDecoder(r.Body).Decode(&alert); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	// Enforce server-derived arena name so callers cannot spoof alerts for other arenas.
	alert.ArenaName = arenaTitle
	alert.BookingID = truncateString(alert.BookingID, 64)
	alert.HallName = truncateString(alert.HallName, 120)
	alert.ClientName = truncateString(alert.ClientName, 120)
	alert.ClientPhone = truncateString(alert.ClientPhone, 50)
	alert.Date = truncateString(alert.Date, 32)
	alert.TimeSlot = truncateString(alert.TimeSlot, 64)
	alert.PaymentType = truncateString(alert.PaymentType, 64)

	if alert.BookingID == "" {
		alert.BookingID = "ALAN-DEMO-001"
	}
	if alert.PaymentType == "" {
		alert.PaymentType = "Kaspi QR"
	}

	w.Header().Set("Content-Type", "application/json")
	err = h.botService.SendBookingAlert(alert)
	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":  "simulated",
			"message": "Notification processed in simulation mode (bot token or network unavailable)",
			"alert":   alert,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":  "sent",
		"message": "Telegram notification successfully dispatched to administrator",
		"alert":   alert,
	})
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	configured := h.botService.token != "" && h.botService.adminChat != ""
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"enabled":    configured,
		"admin_chat": h.botService.adminChat != "",
	})
}
