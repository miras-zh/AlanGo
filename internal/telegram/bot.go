package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type BookingAlert struct {
	BookingID   string `json:"booking_id"`
	ArenaName   string `json:"arena_name"`
	HallName    string `json:"hall_name"`
	ClientName  string `json:"client_name"`
	ClientPhone string `json:"client_phone"`
	Date        string `json:"date"`
	TimeSlot    string `json:"time_slot"`
	TotalPrice  int    `json:"total_price"`
	PaymentType string `json:"payment_type"`
}

type InlineKeyboardButton struct {
	Text         string `json:"text"`
	CallbackData string `json:"callback_data,omitempty"`
	URL          string `json:"url,omitempty"`
}

type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

type SendMessageRequest struct {
	ChatID      string                `json:"chat_id"`
	Text        string                `json:"text"`
	ParseMode   string                `json:"parse_mode"`
	ReplyMarkup *InlineKeyboardMarkup `json:"reply_markup,omitempty"`
}

type BotService struct {
	token      string
	adminChat  string
	httpClient *http.Client
}

func NewBotService() *BotService {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	adminChat := os.Getenv("TELEGRAM_ADMIN_CHAT_ID")
	return &BotService{
		token:      token,
		adminChat:  adminChat,
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

// SendBookingAlert sends a rich interactive message to the arena administrator on Telegram.
func (b *BotService) SendBookingAlert(alert BookingAlert) error {
	if b.token == "" || b.adminChat == "" {
		log.Printf("[TelegramBot] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not configured; simulated alert for booking #%s: %s @ %s",
			alert.BookingID, alert.ClientName, alert.ArenaName)
		return nil
	}

	phoneClean := alert.ClientPhone
	msg := fmt.Sprintf(
		"🔔 <b>НОВАЯ БРОНЬ В ALANGO!</b>\n\n"+
			"🏟 <b>Комплекс:</b> %s\n"+
			"⚽ <b>Зал:</b> %s\n"+
			"📅 <b>Дата:</b> %s\n"+
			"⏰ <b>Время:</b> %s\n"+
			"👤 <b>Клиент:</b> %s\n"+
			"📞 <b>Телефон:</b> %s\n"+
			"💰 <b>Сумма:</b> %d ₸ (%s ✅)\n\n"+
			"<i>Нажмите кнопку ниже для подтверждения или быстрой связи:</i>",
		escapeHTML(alert.ArenaName),
		escapeHTML(alert.HallName),
		escapeHTML(alert.Date),
		escapeHTML(alert.TimeSlot),
		escapeHTML(alert.ClientName),
		escapeHTML(alert.ClientPhone),
		alert.TotalPrice,
		escapeHTML(alert.PaymentType),
	)

	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "✅ Подтвердить бронь", CallbackData: fmt.Sprintf("confirm_%s", alert.BookingID)},
				{Text: "💬 Чат с клиентом", CallbackData: fmt.Sprintf("chat_%s", alert.BookingID)},
			},
			{
				{Text: "🟢 WhatsApp", URL: fmt.Sprintf("https://wa.me/%s", cleanPhoneForURL(phoneClean))},
			},
		},
	}

	reqBody := SendMessageRequest{
		ChatID:      b.adminChat,
		Text:        msg,
		ParseMode:   "HTML",
		ReplyMarkup: keyboard,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", b.token)
	resp, err := b.httpClient.Post(apiURL, "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("[TelegramBot] Failed to send message to Telegram: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("[TelegramBot] Telegram API returned status %d", resp.StatusCode)
		return fmt.Errorf("telegram API status %d", resp.StatusCode)
	}

	log.Printf("[TelegramBot] Successfully delivered booking alert #%s to chat %s", alert.BookingID, b.adminChat)
	return nil
}

func escapeHTML(s string) string {
	var buf bytes.Buffer
	for _, r := range s {
		switch r {
		case '<':
			buf.WriteString("&lt;")
		case '>':
			buf.WriteString("&gt;")
		case '&':
			buf.WriteString("&amp;")
		case '"':
			buf.WriteString("&quot;")
		default:
			buf.WriteRune(r)
		}
	}
	return buf.String()
}

func cleanPhoneForURL(phone string) string {
	var clean []rune
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			clean = append(clean, r)
		}
	}
	return string(clean)
}

