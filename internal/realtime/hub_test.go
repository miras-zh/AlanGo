package realtime

import "testing"

func TestHubPublishEmptyIsNoOp(t *testing.T) {
	h := NewHub()
	if h.IsConnected(1) {
		t.Fatalf("expected user 1 not connected")
	}
	// Should not panic when no connections exist
	h.Publish(1, NewNotificationEvent("test", "Hello", "World"))
	h.CloseUser(1)
}
