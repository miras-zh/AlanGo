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

type Service struct {
	DB          *gorm.DB
	ProjectID   string
	Endpoint    string
	Client      *http.Client
	fcmProject  string
	fcmEndpoint string
	tokenSource oauth2.TokenSource
}

type expoMessage struct {
	To    string `json:"to"`
	Title string `json:"title"`
	Body  string `json:"body"`
	Sound string `json:"sound"`
}

type fcmRequest struct {
	Message fcmMessage `json:"message"`
}

type fcmMessage struct {
	Token        string          `json:"token"`
	Notification fcmNotification `json:"notification"`
	Android      *fcmAndroid     `json:"android,omitempty"`
	APNS         *fcmAPNS        `json:"apns,omitempty"`
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
		ProjectID: projectID,
		Endpoint:  expoPushEndpoint,
		Client:    &http.Client{Timeout: 10 * time.Second},
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

	if s.tokenSource == nil && projectID == "" {
		log.Println("push: neither FIREBASE_SERVICE_ACCOUNT_PATH nor EXPO_PROJECT_ID set — running in dev mode (notifications are logged, not sent)")
	}
	return s
}

func (s *Service) Send(userID uint, title, body string) error {
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

	isExpoToken := strings.HasPrefix(token, "ExponentPushToken[") || strings.HasPrefix(token, "ExpoPushToken[")

	if !isExpoToken && s.tokenSource != nil {
		return s.sendFCM(userID, token, title, body)
	}

	if isExpoToken && s.ProjectID != "" {
		return s.sendExpo(userID, token, title, body)
	}

	if s.tokenSource != nil {
		return s.sendFCM(userID, token, title, body)
	}

	log.Printf("push(dev): would send to user %d (%s): %s — %s", userID, token, title, body)
	return nil
}

func (s *Service) sendFCM(userID uint, deviceToken, title, body string) error {
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
		log.Printf("push(fcm): service returned status %d for user %d: %s", resp.StatusCode, userID, string(respBody))
	}
	return nil
}

func (s *Service) sendExpo(userID uint, token, title, body string) error {
	payload, err := json.Marshal(expoMessage{
		To:    token,
		Title: title,
		Body:  body,
		Sound: "default",
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, s.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		log.Printf("push(expo): failed to send to user %d: %v", userID, err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("push(expo): service returned status %d for user %d", resp.StatusCode, userID)
	}
	return nil
}
