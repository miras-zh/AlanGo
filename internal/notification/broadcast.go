package notification

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"alango/internal/push"
	"alango/internal/realtime"

	"gorm.io/gorm"
)

const (
	maxBroadcastTitleRunes = 160
	maxBroadcastBodyRunes  = 2000
)

var (
	ErrBroadcastTitleRequired = errors.New("укажите заголовок рассылки")
	ErrBroadcastBodyRequired  = errors.New("укажите текст рассылки")
	ErrBroadcastTooLong       = errors.New("текст рассылки превышает допустимую длину")
	ErrNoOwnedArena           = errors.New("у аккаунта нет спортивного комплекса")
)

type BroadcastCampaign struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SenderUserID    *uint     `gorm:"column:sender_user_id" json:"sender_user_id,omitempty"`
	Scope           string    `gorm:"column:scope;type:varchar(20);not null" json:"scope"`
	ArenaID         *uint     `gorm:"column:arena_id" json:"arena_id,omitempty"`
	Title           string    `gorm:"column:title;type:varchar(160);not null" json:"title"`
	Body            string    `gorm:"column:body;type:text;not null" json:"body"`
	TargetFilter    string    `gorm:"column:target_filter;type:varchar(160);not null" json:"target_filter"`
	RecipientsCount int       `gorm:"column:recipients_count;not null;default:0" json:"recipients_count"`
	PushSentCount   int       `gorm:"column:push_sent_count;not null;default:0" json:"push_sent_count"`
	CreatedAt       time.Time `gorm:"column:created_at;default:now()" json:"created_at"`
}

func (BroadcastCampaign) TableName() string { return "broadcast_campaigns" }

type PlatformBroadcastRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Role  string `json:"role"` // "" | "all" | "client" | "business"
	City  string `json:"city"`
}

type ArenaBroadcastRequest struct {
	Title   string `json:"title"`
	Body    string `json:"body"`
	Segment string `json:"segment"` // "all" | "vip" | "regular"
}

type ArenaBroadcastResult struct {
	Campaign          BroadcastCampaign `json:"campaign"`
	TotalArenaClients int               `json:"total_arena_clients"`
	AppLinkedClients  int               `json:"app_linked_clients"`
}

func validateBroadcastContent(rawTitle, rawBody string) (string, string, error) {
	title := strings.TrimSpace(rawTitle)
	body := strings.TrimSpace(rawBody)
	if title == "" {
		return "", "", ErrBroadcastTitleRequired
	}
	if body == "" {
		return "", "", ErrBroadcastBodyRequired
	}
	if utf8.RuneCountInString(title) > maxBroadcastTitleRunes || utf8.RuneCountInString(body) > maxBroadcastBodyRunes {
		return "", "", ErrBroadcastTooLong
	}
	return title, body, nil
}

type recipientRow struct {
	ID        uint   `gorm:"column:id"`
	PushToken string `gorm:"column:push_token"`
}

func (s *Service) deliverBroadcast(
	ctx context.Context,
	senderID uint,
	scope string,
	arenaID *uint,
	notifType string,
	filterLabel string,
	title string,
	body string,
	recipients []recipientRow,
) (BroadcastCampaign, error) {
	now := time.Now()
	seen := make(map[uint]struct{}, len(recipients))
	uniq := make([]recipientRow, 0, len(recipients))
	for _, r := range recipients {
		if r.ID == 0 {
			continue
		}
		if _, ok := seen[r.ID]; ok {
			continue
		}
		seen[r.ID] = struct{}{}
		uniq = append(uniq, r)
	}

	if len(uniq) > 0 {
		notifs := make([]Notification, 0, len(uniq))
		actor := senderID
		for _, r := range uniq {
			notifs = append(notifs, Notification{
				UserID:    r.ID,
				ActorID:   &actor,
				Type:      notifType,
				Title:     title,
				Body:      body,
				EntityID:  arenaID,
				Read:      false,
				CreatedAt: now,
			})
		}
		if err := s.DB.WithContext(ctx).CreateInBatches(notifs, 200).Error; err != nil {
			return BroadcastCampaign{}, err
		}
		if s.hub != nil {
			ev := realtime.NewNotificationEvent(notifType, title, body)
			for _, r := range uniq {
				s.hub.Publish(r.ID, ev)
			}
		}
	}

	pushSent := 0
	if s.pushService != nil && len(uniq) > 0 {
		targets := make([]push.PushTarget, 0, len(uniq))
		for _, r := range uniq {
			if r.PushToken != "" {
				targets = append(targets, push.PushTarget{UserID: r.ID, Token: r.PushToken})
			}
		}
		if len(targets) > 0 {
			data := map[string]any{"type": notifType}
			if arenaID != nil {
				data["entity_id"] = *arenaID
			}
			n, _ := s.pushService.SendBatch(targets, title, body, data)
			pushSent = n
		}
	}

	campaign := BroadcastCampaign{
		SenderUserID:    &senderID,
		Scope:           scope,
		ArenaID:         arenaID,
		Title:           title,
		Body:            body,
		TargetFilter:    filterLabel,
		RecipientsCount: len(uniq),
		PushSentCount:   pushSent,
		CreatedAt:       now,
	}
	if err := s.DB.WithContext(ctx).Create(&campaign).Error; err != nil {
		return BroadcastCampaign{}, err
	}
	return campaign, nil
}

// BroadcastPlatform sends an app-wide push + in-app campaign (admin only).
func (s *Service) BroadcastPlatform(ctx context.Context, adminID uint, req PlatformBroadcastRequest) (BroadcastCampaign, error) {
	title, body, err := validateBroadcastContent(req.Title, req.Body)
	if err != nil {
		return BroadcastCampaign{}, err
	}

	role := strings.TrimSpace(req.Role)
	city := strings.TrimSpace(req.City)
	q := s.DB.WithContext(ctx).Table("users").
		Select("id, COALESCE(push_token, '') AS push_token").
		Where("active = true AND marketing_push_enabled = true")

	if role == "client" || role == "business" {
		q = q.Where("role = ?", role)
	} else {
		role = "all"
	}
	if city != "" {
		q = q.Where("LOWER(city) = LOWER(?)", city)
	}

	var recipients []recipientRow
	if err := q.Order("id ASC").Scan(&recipients).Error; err != nil {
		return BroadcastCampaign{}, err
	}

	filter := role
	if city != "" {
		filter += ":" + city
	}
	return s.deliverBroadcast(ctx, adminID, "platform", nil, "platform_broadcast", filter, title, body, recipients)
}

// BroadcastArena sends an arena's promotional/informational broadcast to its
// linked CRM clients who have an app account and marketing_push_enabled=true.
func (s *Service) BroadcastArena(ctx context.Context, ownerID uint, req ArenaBroadcastRequest) (ArenaBroadcastResult, error) {
	title, body, err := validateBroadcastContent(req.Title, req.Body)
	if err != nil {
		return ArenaBroadcastResult{}, err
	}

	var arena struct {
		ID uint
	}
	if err := s.DB.WithContext(ctx).Table("arenas").
		Select("id").
		Where("owner_id = ?", ownerID).
		Order("id ASC").
		Take(&arena).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ArenaBroadcastResult{}, ErrNoOwnedArena
		}
		return ArenaBroadcastResult{}, err
	}

	var totalClients int64
	_ = s.DB.WithContext(ctx).Table("arena_clients").Where("arena_id = ?", arena.ID).Count(&totalClients).Error

	var linkedClients int64
	_ = s.DB.WithContext(ctx).Table("arena_clients").Where("arena_id = ? AND user_id IS NOT NULL", arena.ID).Count(&linkedClients).Error

	segment := strings.TrimSpace(req.Segment)
	if segment != "vip" && segment != "regular" {
		segment = "all"
	}

	type candidateRow struct {
		ID              uint   `gorm:"column:id"`
		PushToken       string `gorm:"column:push_token"`
		SegmentOverride string `gorm:"column:segment_override"`
		TotalSpent      int64  `gorm:"column:total_spent"`
		BookingCount    int64  `gorm:"column:booking_count"`
	}
	var candidates []candidateRow
	err = s.DB.WithContext(ctx).Raw(`
		SELECT
			u.id,
			COALESCE(u.push_token, '') AS push_token,
			ac.segment_override,
			COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price ELSE 0 END), 0) AS total_spent,
			COUNT(b.id) AS booking_count
		FROM arena_clients ac
		JOIN users u ON u.id = ac.user_id
		LEFT JOIN bookings b ON b.arena_id = ac.arena_id AND (
			b.user_id = ac.user_id OR
			(LENGTH(RIGHT(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g'), 10)) = 10
			 AND RIGHT(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g'), 10) = ac.phone_key)
		)
		WHERE ac.arena_id = ?
		  AND ac.user_id IS NOT NULL
		  AND ac.segment_override <> 'blocked'
		  AND u.active = true
		  AND u.marketing_push_enabled = true
		GROUP BY u.id, u.push_token, ac.segment_override
	`, arena.ID).Scan(&candidates).Error
	if err != nil {
		return ArenaBroadcastResult{}, err
	}

	recipients := make([]recipientRow, 0, len(candidates))
	for _, c := range candidates {
		switch segment {
		case "vip":
			if c.SegmentOverride != "vip" && c.TotalSpent <= 40000 {
				continue
			}
		case "regular":
			if c.SegmentOverride != "regular" && c.BookingCount < 2 {
				continue
			}
		}
		recipients = append(recipients, recipientRow{ID: c.ID, PushToken: c.PushToken})
	}

	arenaID := arena.ID
	campaign, err := s.deliverBroadcast(ctx, ownerID, "arena", &arenaID, "arena_broadcast", segment, title, body, recipients)
	if err != nil {
		return ArenaBroadcastResult{}, err
	}

	return ArenaBroadcastResult{
		Campaign:          campaign,
		TotalArenaClients: int(totalClients),
		AppLinkedClients:  int(linkedClients),
	}, nil
}

func (s *Service) ListPlatformCampaigns(ctx context.Context) ([]BroadcastCampaign, error) {
	items := []BroadcastCampaign{}
	err := s.DB.WithContext(ctx).
		Where("scope = 'platform'").
		Order("created_at DESC").
		Limit(30).
		Find(&items).Error
	return items, err
}

func (s *Service) ListArenaCampaigns(ctx context.Context, ownerID uint) ([]BroadcastCampaign, error) {
	var arena struct{ ID uint }
	if err := s.DB.WithContext(ctx).Table("arenas").
		Select("id").
		Where("owner_id = ?", ownerID).
		Order("id ASC").
		Take(&arena).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []BroadcastCampaign{}, nil
		}
		return nil, err
	}
	items := []BroadcastCampaign{}
	err := s.DB.WithContext(ctx).
		Where("scope = 'arena' AND arena_id = ?", arena.ID).
		Order("created_at DESC").
		Limit(30).
		Find(&items).Error
	return items, err
}
