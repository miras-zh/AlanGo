package realtime

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu    sync.RWMutex
	conns map[uint]map[*conn]struct{}
}

func NewHub() *Hub {
	return &Hub{conns: make(map[uint]map[*conn]struct{})}
}

func (h *Hub) register(c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.conns[c.userID] == nil {
		h.conns[c.userID] = make(map[*conn]struct{})
	}
	h.conns[c.userID][c] = struct{}{}
}

func (h *Hub) unregister(c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	set, ok := h.conns[c.userID]
	if !ok {
		return
	}
	delete(set, c)
	if len(set) == 0 {
		delete(h.conns, c.userID)
	}
}

func (h *Hub) Publish(userID uint, ev Event) {
	if h == nil || userID == 0 {
		return
	}

	payload, err := json.Marshal(ev)
	if err != nil {
		log.Println("realtime: failed to marshal event:", err)
		return
	}

	h.mu.RLock()
	set := h.conns[userID]
	targets := make([]*conn, 0, len(set))
	for c := range set {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		if !c.trySend(payload) {
			c.close()
		}
	}
}

func (h *Hub) CloseUser(userID uint) {
	if h == nil {
		return
	}
	h.mu.RLock()
	set := h.conns[userID]
	targets := make([]*conn, 0, len(set))
	for c := range set {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		c.close()
	}
}

func (h *Hub) IsConnected(userID uint) bool {
	if h == nil || userID == 0 {
		return false
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conns[userID]) > 0
}

func (h *Hub) Serve(userID uint, ws *websocket.Conn) {
	c := &conn{
		ws:     ws,
		send:   make(chan []byte, sendBufferSize),
		hub:    h,
		userID: userID,
	}

	h.register(c)
	go c.writePump()
	c.readPump()
}
