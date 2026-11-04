package notification

import (
	"alango/internal/push"
	"alango/internal/realtime"
	"alango/internal/safego"

	"gorm.io/gorm"
)

type Service struct {
	DB          *gorm.DB
	hub         *realtime.Hub
	pushService *push.Service
}

func NewService(db *gorm.DB, hub *realtime.Hub, pushService *push.Service) *Service {
	return &Service{DB: db, hub: hub, pushService: pushService}
}

// Create stores a notification row, broadcasts it over WebSocket when
// broadcast is true, and sends a push notification in the background.
func (s *Service) Create(userID uint, actorID *uint, notifType, title, body string, entityID *uint, broadcast bool) error {
	n := Notification{
		UserID:   userID,
		ActorID:  actorID,
		Type:     notifType,
		Title:    title,
		Body:     body,
		EntityID: entityID,
	}
	if err := s.DB.Create(&n).Error; err != nil {
		return err
	}
	if broadcast && s.hub != nil {
		s.hub.Publish(userID, realtime.NewNotificationEvent(notifType, title, body))
	}
	if s.pushService != nil {
		safego.Go(func() {
			_ = s.pushService.Send(userID, title, body)
		})
	}
	return nil
}

func (s *Service) List(userID uint) ([]Notification, int64, error) {
	items := []Notification{}
	err := s.DB.Table("notifications n").
		Select(`n.*,
			COALESCE(NULLIF(u.photo, ''), '') AS actor_avatar,
			COALESCE(u.full_name, '') AS actor_name`).
		Joins("LEFT JOIN users u ON u.id = n.actor_id").
		Where("n.user_id = ?", userID).
		Order("n.created_at DESC").
		Limit(50).
		Find(&items).Error
	if err != nil {
		return nil, 0, err
	}

	var unread int64
	if err := s.DB.Model(&Notification{}).
		Where("user_id = ? AND read = false", userID).
		Count(&unread).Error; err != nil {
		return nil, 0, err
	}
	return items, unread, nil
}

func (s *Service) MarkAllRead(userID uint) error {
	return s.DB.Model(&Notification{}).
		Where("user_id = ? AND read = false", userID).
		Update("read", true).Error
}
