package mail

import (
	"strings"
	"testing"
)

func TestExtractEnvelopeAddress(t *testing.T) {
	if got := extractEnvelopeAddress("AlanGo <no-reply@example.com>"); got != "no-reply@example.com" {
		t.Fatalf("got %q", got)
	}
	if got := extractEnvelopeAddress("plain@example.com"); got != "plain@example.com" {
		t.Fatalf("got %q", got)
	}
}

func TestBuildMessagesIncludeToAndStripCRLF(t *testing.T) {
	msg := string(buildMessage("AlanGo <from@example.com>", []string{"to@example.com"}, "Hi\r\nBcc: evil@x.com", "Body"))
	if !strings.Contains(msg, "To: to@example.com\r\n") {
		t.Fatalf("missing To header in %q", msg)
	}
	if strings.Contains(msg, "Subject: Hi\r\nBcc:") {
		t.Fatalf("CRLF injection not stripped: %q", msg)
	}

	mp := string(buildMultipartMessage("AlanGo <from@example.com>", []string{"a@b.com"}, "Subj", "plain", "<b>html</b>"))
	if !strings.Contains(mp, "To: a@b.com\r\n") {
		t.Fatalf("missing To header in multipart message")
	}
}

func TestIsLocalSMTPHost(t *testing.T) {
	if !isLocalSMTPHost("localhost") || !isLocalSMTPHost("mailpit") || isLocalSMTPHost("smtp.example.com") {
		t.Fatalf("unexpected isLocalSMTPHost result")
	}
}
