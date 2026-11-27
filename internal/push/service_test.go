package push

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestSendBatchExpoDeduplicatesAndChunks(t *testing.T) {
	var received [][]expoMessage

	s := NewService(nil, "", "")
	s.Endpoint = "https://push.local/send"
	s.Client = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			var batch []expoMessage
			if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
				t.Fatalf("decode request: %v", err)
			}
			received = append(received, batch)
			tickets := make([]expoTicket, len(batch))
			for i := range batch {
				tickets[i] = expoTicket{Status: "ok"}
			}
			bodyBytes, _ := json.Marshal(map[string]any{"data": tickets})
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(bodyBytes)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	targets := []PushTarget{
		{UserID: 1, Token: "ExponentPushToken[aaa]"},
		{UserID: 2, Token: "ExponentPushToken[aaa]"}, // duplicate token skipped
		{UserID: 3, Token: ""},                       // empty token skipped
		{UserID: 4, Token: "ExpoPushToken[bbb]"},
	}

	sent, err := s.SendBatch(targets, "AlanGo", "Test body", map[string]any{"type": "booking_confirmed"})
	if err != nil {
		t.Fatalf("SendBatch error: %v", err)
	}
	if sent != 2 {
		t.Fatalf("expected 2 sent, got %d", sent)
	}
	if len(received) != 1 || len(received[0]) != 2 {
		t.Fatalf("unexpected request batches: %+v", received)
	}
	if received[0][0].Priority != "high" || received[0][0].ChannelID != "default" {
		t.Fatalf("expected high priority & default channelId, got %+v", received[0][0])
	}
}

func TestIsExpoPushToken(t *testing.T) {
	if !IsExpoPushToken("ExponentPushToken[abc123]") {
		t.Fatal("expected ExponentPushToken to be detected")
	}
	if !IsExpoPushToken("ExpoPushToken[xyz]") {
		t.Fatal("expected ExpoPushToken to be detected")
	}
	if IsExpoPushToken("fcm-native-device-token") {
		t.Fatal("did not expect FCM token to be classified as Expo token")
	}
}
