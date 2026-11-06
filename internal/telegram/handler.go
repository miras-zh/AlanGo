package telegram

import (
	"encoding/json"
	"net/http"
)

type Handler struct {
	botService *BotService
}

func NewHandler(bot *BotService) *Handler {
	return &Handler{botService: bot}
}

func (h *Handler) NotifyBooking(w http.ResponseWriter, r *http.Request) {
	var alert BookingAlert
	if err := json.NewDecoder(r.Body).Decode(&alert); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if alert.BookingID == "" {
		alert.BookingID = "ALAN-DEMO-001"
	}
	if alert.PaymentType == "" {
		alert.PaymentType = "Kaspi QR"
	}

	w.Header().Set("Content-Type", "application/json")
	err := h.botService.SendBookingAlert(alert)
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
