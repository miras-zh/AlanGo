package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send"
const fcmScope = "https://www.googleapis.com/auth/firebase.messaging"
const expoMaxBatchSize = 100

type Service struct {
	DB          *gorm.DB
	ProjectID   string
	AccessToken string
	Endpoint    string
	Client      *http.Client
	fcmProject  string
	fcmEndpoint string
	tokenSource oauth2.TokenSource
}

type PushTarget struct {
	UserID uint   `json:"user_id"`
	Token  string `json:"token"`
}

type Status struct {
	HasToken        bool   `json:"has_token"`
	TokenKind       string `json:"token_kind"` // "expo" | "native" | ""
	ExpoConfigured  bool   `json:"expo_configured"`
	FCMConfigured   bool   `json:"fcm_configured"`
	TransportReady  bool   `json:"transport_ready"`
	MarketingOptIn  bool   `json:"marketing_push_enabled"`
}

type expoMessage struct {
	To        string         `json:"to"`
	Title     string         `json:"title"`
	Body      string         `json:"body"`
	Sound     string         `json:"sound"`
	Priority  string         `json:"priority,omitempty"`
	ChannelID string         `json:"channelId,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
}

type expoTicket struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Details struct {
		Error string `json:"error"`
	} `json:"details"`
}

type fcmRequest struct {
	Message fcmMessage `json:"message"`
}

type fcmMessage struct {
	Token        string            `json:"token"`
	Notification fcmNotification   `json:"notification"`
	Data         map[string]string `json:"data,omitempty"`
	Android      *fcmAndroid       `json:"android,omitempty"`
	APNS         *fcmAPNS          `json:"apns,omitempty"`
}

type fcmNotification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type fcmAndroid struct {
	Priority     string                  `json:"priority,omitempty"`
	Notification *fcmAndroidNotification `json:"notification,omitempty"`
}

type fcmAndroidNotification struct {
	Sound     string `json:"sound,omitempty"`
	ChannelID string `json:"channel_id,omitempty"`
}

type fcmAPNS struct {
	Headers map[string]string `json:"headers,omitempty"`
	Payload *fcmAPNSPayload   `json:"payload,omitempty"`
}

type fcmAPNSPayload struct {
	APS fcmAPS `json:"aps"`
}

type fcmAPS struct {
	Sound string `json:"sound,omitempty"`
}

func NewService(db *gorm.DB, projectID string, firebaseServiceAccountPath string) *Service {
	s := &Service{
		DB:        db,
		ProjectID: strings.TrimSpace(projectID),
		Endpoint:  expoPushEndpoint,
		Client:    &http.Client{Timeout: 15 * time.Second},
	}

	if firebaseServiceAccountPath != "" {
		data, err := os.ReadFile(firebaseServiceAccountPath)
		if err != nil {
			log.Printf("push: failed to read FIREBASE_SERVICE_ACCOUNT_PATH (%s): %v", firebaseServiceAccountPath, err)
		} else {
			creds, err := google.CredentialsFromJSON(context.Background(), data, fcmScope)
			if err != nil {
				log.Printf("push: failed to parse Firebase service account JSON: %v", err)
			} else if creds.ProjectID == "" {
				log.Printf("push: Firebase service account JSON is missing project_id")
			} else {
				s.fcmProject = creds.ProjectID
				s.fcmEndpoint = fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", creds.ProjectID)
				s.tokenSource = creds.TokenSource
				log.Printf("push: Firebase Cloud Messaging configured (project=%s)", creds.ProjectID)
			}
		}
	}

	if s.ProjectID != "" {
		log.Printf("push: Expo Push configured (project=%s)", s.ProjectID)
	} else {
		log.Println("push: Expo Push ready for ExponentPushToken devices; set EXPO_PROJECT_ID / FIREBASE_SERVICE_ACCOUNT_PATH for full production delivery")
	}
	return s
}

func (s *Service) SetAccessToken(token string) {
	if s != nil {
		s.AccessToken = strings.TrimSpace(token)
	}
}

func IsExpoPushToken(token string) bool {
	return strings.HasPrefix(token, "ExponentPushToken[") || strings.HasPrefix(token, "ExpoPushToken[")
}

func (s *Service) GetUserStatus(userID uint) (Status, error) {
	var row struct {
		PushToken            string `gorm:"column:push_token"`
		MarketingPushEnabled bool   `gorm:"column:marketing_push_enabled"`
	}
	if err := s.DB.Table("users").
		Select("COALESCE(push_token, '') AS push_token, marketing_push_enabled").
		Where("id = ?", userID).
		Take(&row).Error; err != nil {
		return Status{}, err
	}
	st := Status{
		HasToken:       row.PushToken != "",
		ExpoConfigured: s.ProjectID != "",
		FCMConfigured:  s.tokenSource != nil,
		MarketingOptIn: row.MarketingPushEnabled,
	}
	if row.PushToken != "" {
		if IsExpoPushToken(row.PushToken) {
			st.TokenKind = "expo"
			st.TransportReady = true
		} else {
			st.TokenKind = "native"
			st.TransportReady = s.tokenSource != nil
		}
	}
	return st, nil
}

func (s *Service) Send(userID uint, title, body string) error {
	return s.SendWithData(userID, title, body, nil)
}

func (s *Service) SendWithData(userID uint, title, body string, data map[string]any) error {
	if s == nil || s.DB == nil {
		return nil
	}
	var token string
	err := s.DB.Table("users").
		Select("COALESCE(push_token, '')").
		Where("id = ?", userID).
		Scan(&token).Error
	if err != nil {
		return err
	}
	if token == "" {
		return nil
	}
	_, err = s.SendBatch([]PushTarget{{UserID: userID, Token: token}}, title, body, data)
	return err
}

// SendBatch delivers a notification to all valid targets via Expo Push (chunked
// up to 100 messages per HTTP call) and FCM HTTP v1, returning delivered count.
func (s *Service) SendBatch(targets []PushTarget, title, body string, data map[string]any) (int, error) {
	if s == nil || len(targets) == 0 {
		return 0, nil
	}
	var expoTargets []PushTarget
	var fcmTargets []PushTarget
	seenTokens := make(map[string]struct{}, len(targets))
	for _, t := range targets {
		tok := strings.TrimSpace(t.Token)
		if tok == "" {
			continue
		}
		if _, dup := seenTokens[tok]; dup {
			continue
		}
		seenTokens[tok] = struct{}{}
		if IsExpoPushToken(tok) {
			expoTargets = append(expoTargets, PushTarget{UserID: t.UserID, Token: tok})
		} else {
			fcmTargets = append(fcmTargets, PushTarget{UserID: t.UserID, Token: tok})
		}
	}

	sent := 0
	var firstErr error

	for i := 0; i < len(expoTargets); i += expoMaxBatchSize {
		end := i + expoMaxBatchSize
		if end > len(expoTargets) {
			end = len(expoTargets)
		}
		n, err := s.sendExpoBatch(expoTargets[i:end], title, body, data)
		sent += n
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}

	strData := stringifyData(data)
	for _, target := range fcmTargets {
		if s.tokenSource == nil {
			log.Printf("push(skip): native token for user %d skipped because FIREBASE_SERVICE_ACCOUNT_PATH is not configured", target.UserID)
			continue
		}
		if err := s.sendFCM(target.UserID, target.Token, title, body, strData); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		sent++
	}

	return sent, firstErr
}

func (s *Service) clearDeadToken(userID uint, token string) {
	if s.DB == nil || token == "" {
		return
	}
	_ = s.DB.Table("users").
		Where("id = ? AND push_token = ?", userID, token).
		Update("push_token", "").Error
}

func stringifyData(data map[string]any) map[string]string {
	if len(data) == 0 {
		return nil
	}
	out := make(map[string]string, len(data))
	for k, v := range data {
		if v == nil {
			continue
		}
		out[k] = fmt.Sprint(v)
	}
	return out
}

func (s *Service) sendFCM(userID uint, deviceToken, title, body string, data map[string]string) error {
	oauthTok, err := s.tokenSource.Token()
	if err != nil {
		log.Printf("push(fcm): failed to obtain OAuth2 token for user %d: %v", userID, err)
		return err
	}

	payload, err := json.Marshal(fcmRequest{
		Message: fcmMessage{
			Token: deviceToken,
			Notification: fcmNotification{
				Title: title,
				Body:  body,
			},
			Data: data,
			Android: &fcmAndroid{
				Priority: "high",
				Notification: &fcmAndroidNotification{
					Sound:     "default",
					ChannelID: "default",
				},
			},
			APNS: &fcmAPNS{
				Headers: map[string]string{
					"apns-priority":  "10",
					"apns-push-type": "alert",
				},
				Payload: &fcmAPNSPayload{
					APS: fcmAPS{
						Sound: "default",
					},
				},
			},
		},
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, s.fcmEndpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+oauthTok.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		log.Printf("push(fcm): failed to send to user %d: %v", userID, err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		msg := string(respBody)
		log.Printf("push(fcm): service returned status %d for user %d: %s", resp.StatusCode, userID, msg)
		if strings.Contains(msg, "UNREGISTERED") || strings.Contains(msg, "registration-token-not-registered") {
			s.clearDeadToken(userID, deviceToken)
		}
		return fmt.Errorf("fcm status %d", resp.StatusCode)
	}
	return nil
}

func (s *Service) sendExpoBatch(targets []PushTarget, title, body string, data map[string]any) (int, error) {
	if len(targets) == 0 {
		return 0, nil
	}
	msgs := make([]expoMessage, len(targets))
	for i, t := range targets {
		msgs[i] = expoMessage{
			To:        t.Token,
			Title:     title,
			Body:      body,
			Sound:     "default",
			Priority:  "high",
			ChannelID: "default",
			Data:      data,
		}
	}

	payload, err := json.Marshal(msgs)
	if err != nil {
		return 0, err
	}

	req, err := http.NewRequest(http.MethodPost, s.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if s.AccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.AccessToken)
	}

	resp, err := s.Client.Do(req)
	if err != nil {
		log.Printf("push(expo): batch send failed (%d targets): %v", len(targets), err)
		return 0, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode >= 300 {
		log.Printf("push(expo): service returned status %d: %s", resp.StatusCode, string(respBytes))
		return 0, fmt.Errorf("expo push status %d", resp.StatusCode)
	}

	var envelope struct {
		Data []expoTicket `json:"data"`
	}
	if err := json.Unmarshal(respBytes, &envelope); err != nil || len(envelope.Data) == 0 {
		// Fallback if single-object response or unparsed ok response
		return len(targets), nil
	}

	sent := 0
	for i, ticket := range envelope.Data {
		if i >= len(targets) {
			break
		}
		if ticket.Status == "ok" {
			sent++
			continue
		}
		log.Printf("push(expo): ticket error for user %d (%s): %s", targets[i].UserID, ticket.Details.Error, ticket.Message)
		if ticket.Details.Error == "DeviceNotRegistered" {
			s.clearDeadToken(targets[i].UserID, targets[i].Token)
		}
	}
	return sent, nil
}
