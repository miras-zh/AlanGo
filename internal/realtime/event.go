package realtime

import "time"

type EventType string

const (
	EventNotification EventType = "notification.new"
	EventItemCreated  EventType = "item.created"
	EventItemUpdated  EventType = "item.updated"
	EventItemDeleted  EventType = "item.deleted"
)

type Event struct {
	Type      EventType `json:"type"`
	ItemID    uint      `json:"item_id,omitempty"`
	Item      any       `json:"item,omitempty"`
	NotifType string    `json:"notif_type,omitempty"`
	Title     string    `json:"title,omitempty"`
	Body      string    `json:"body,omitempty"`
	At        string    `json:"at"`
}

func NewNotificationEvent(notifType, title, body string) Event {
	return Event{
		Type:      EventNotification,
		NotifType: notifType,
		Title:     title,
		Body:      body,
		At:        time.Now().UTC().Format(time.RFC3339),
	}
}

func NewItemEvent(eventType EventType, itemID uint, item any) Event {
	return Event{
		Type:   eventType,
		ItemID: itemID,
		Item:   item,
		At:     time.Now().UTC().Format(time.RFC3339),
	}
}
