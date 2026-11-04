package realtime

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"

	"alango/internal/auth"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

type Handler struct {
	hub           *Hub
	rdb           *redis.Client
	allowedOrigin string
}

func NewHandler(hub *Hub, rdb *redis.Client, allowedOrigin string) *Handler {
	return &Handler{hub: hub, rdb: rdb, allowedOrigin: allowedOrigin}
}

type mintTicketResponse struct {
	Ticket    string `json:"ticket"`
	ExpiresIn int    `json:"expires_in"`
}

func (h *Handler) MintTicket(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	token, err := MintTicket(r.Context(), h.rdb, userID)
	if err != nil {
		http.Error(w, "failed to mint ticket", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(mintTicketResponse{Ticket: token, ExpiresIn: int(ticketTTL.Seconds())})
}

func (h *Handler) checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if origin == h.allowedOrigin {
		return true
	}
	if u, err := url.Parse(origin); err == nil && u.Host == r.Host {
		return true
	}
	return false
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	ticket := r.URL.Query().Get("ticket")
	if ticket == "" {
		http.Error(w, "missing ticket", http.StatusUnauthorized)
		return
	}

	userID, err := ConsumeTicket(r.Context(), h.rdb, ticket)
	if err != nil {
		if errors.Is(err, ErrInvalidTicket) {
			http.Error(w, "invalid or expired ticket", http.StatusUnauthorized)
			return
		}
		http.Error(w, "failed to validate ticket", http.StatusInternalServerError)
		return
	}

	upgrader := websocket.Upgrader{CheckOrigin: h.checkOrigin}
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	h.hub.Serve(userID, ws)
}
