package mail

import (
	"bytes"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"strings"
	"time"
)

const (
	smtpDialTimeout        = 10 * time.Second
	smtpTransactionTimeout = 30 * time.Second
)

type SenderConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	Brand    string
	SiteURL  string
}

type Sender struct {
	cfg SenderConfig
}

func NewSender(cfg SenderConfig) *Sender {
	if cfg.Brand == "" {
		cfg.Brand = "AlanGo"
	}
	if cfg.SiteURL == "" {
		cfg.SiteURL = "http://localhost:3002"
	}
	if cfg.Host == "" {
		log.Println("mail: SMTP not configured — running in dev mode (emails are logged, not sent)")
	}
	return &Sender{cfg: cfg}
}

func (s *Sender) Enabled() bool {
	return s.cfg.Host != ""
}

func (s *Sender) Send(recipients []string, subject, body string) error {
	if len(recipients) == 0 {
		return nil
	}
	if !s.Enabled() {
		log.Printf("mail(dev): would send %q to %d recipient(s): %s\n%s",
			subject, len(recipients), strings.Join(recipients, ", "), body)
		return nil
	}
	return s.deliver(recipients, buildMessage(s.cfg.From, recipients, subject, body))
}

func (s *Sender) SendTemplate(recipients []string, subject string, data TemplateData) error {
	if len(recipients) == 0 {
		return nil
	}
	if data.Brand == "" {
		data.Brand = s.cfg.Brand
	}
	if data.SiteURL == "" {
		data.SiteURL = s.cfg.SiteURL
	}
	plain := plainTextFallback(data)
	if !s.Enabled() {
		log.Printf("mail(dev): would send %q to %d recipient(s): %s\n%s",
			subject, len(recipients), strings.Join(recipients, ", "), plain)
		return nil
	}
	html, err := renderNotificationHTML(data)
	if err != nil {
		return fmt.Errorf("mail: render template: %w", err)
	}
	return s.deliver(recipients, buildMultipartMessage(s.cfg.From, recipients, subject, plain, html))
}

func extractEnvelopeAddress(from string) string {
	from = strings.TrimSpace(from)
	if addr, err := mail.ParseAddress(from); err == nil && addr.Address != "" {
		return addr.Address
	}
	return from
}

func isLocalSMTPHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	return h == "localhost" || h == "127.0.0.1" || h == "::1" || h == "mailpit"
}

func (s *Sender) deliver(recipients []string, msg []byte) error {
	addr := s.cfg.Host + ":" + s.cfg.Port
	var auth smtp.Auth
	if s.cfg.Username != "" || s.cfg.Password != "" {
		auth = smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)
	}
	envelopeFrom := extractEnvelopeAddress(s.cfg.From)

	if s.cfg.Port == "465" {
		return sendMailTLS(addr, s.cfg.Host, auth, envelopeFrom, recipients, msg)
	}
	return sendMailPlain(addr, s.cfg.Host, auth, envelopeFrom, recipients, msg)
}

func sendMailPlain(addr, host string, auth smtp.Auth, from string, recipients []string, msg []byte) error {
	conn, err := net.DialTimeout("tcp", addr, smtpDialTimeout)
	if err != nil {
		return fmt.Errorf("mail: dial: %w", err)
	}
	if err := conn.SetDeadline(time.Now().Add(smtpTransactionTimeout)); err != nil {
		conn.Close()
		return fmt.Errorf("mail: set deadline: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("mail: smtp client: %w", err)
	}
	defer c.Close()

	encrypted := false
	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: host}); err != nil {
			return fmt.Errorf("mail: starttls: %w", err)
		}
		encrypted = true
	}
	if auth != nil {
		if !encrypted && !isLocalSMTPHost(host) {
			return errors.New("mail: refusing to send SMTP credentials without STARTTLS on non-local host")
		}
		if ok, _ := c.Extension("AUTH"); ok {
			if err := c.Auth(auth); err != nil {
				return fmt.Errorf("mail: auth: %w", err)
			}
		}
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("mail: mail from: %w", err)
	}
	for _, rcpt := range recipients {
		if err := c.Rcpt(rcpt); err != nil {
			return fmt.Errorf("mail: rcpt to %s: %w", rcpt, err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("mail: data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("mail: write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("mail: close: %w", err)
	}
	return c.Quit()
}

func sendMailTLS(addr, host string, auth smtp.Auth, from string, recipients []string, msg []byte) error {
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: smtpDialTimeout}, "tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return fmt.Errorf("mail: tls dial: %w", err)
	}
	if err := conn.SetDeadline(time.Now().Add(smtpTransactionTimeout)); err != nil {
		conn.Close()
		return fmt.Errorf("mail: set deadline: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("mail: smtp client: %w", err)
	}
	defer c.Close()

	if auth != nil {
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("mail: auth: %w", err)
		}
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("mail: mail from: %w", err)
	}
	for _, rcpt := range recipients {
		if err := c.Rcpt(rcpt); err != nil {
			return fmt.Errorf("mail: rcpt to %s: %w", rcpt, err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("mail: data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("mail: write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("mail: close: %w", err)
	}
	return c.Quit()
}

func buildMessage(from string, recipients []string, subject, body string) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", sanitizeHeaderValue(from))
	fmt.Fprintf(&b, "To: %s\r\n", sanitizeHeaderValue(strings.Join(recipients, ", ")))
	fmt.Fprintf(&b, "Subject: %s\r\n", sanitizeHeaderValue(subject))
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=\"utf-8\"\r\n")
	b.WriteString("\r\n")
	b.WriteString(body)
	return []byte(b.String())
}

func buildMultipartMessage(from string, recipients []string, subject, plainBody, htmlBody string) []byte {
	var parts bytes.Buffer
	mw := multipart.NewWriter(&parts)

	textHeader := textproto.MIMEHeader{
		"Content-Type":              {`text/plain; charset="utf-8"`},
		"Content-Transfer-Encoding": {"quoted-printable"},
	}
	if textPart, err := mw.CreatePart(textHeader); err == nil {
		qp := quotedprintable.NewWriter(textPart)
		qp.Write([]byte(plainBody))
		qp.Close()
	}

	htmlHeader := textproto.MIMEHeader{
		"Content-Type":              {`text/html; charset="utf-8"`},
		"Content-Transfer-Encoding": {"quoted-printable"},
	}
	if htmlPart, err := mw.CreatePart(htmlHeader); err == nil {
		qp := quotedprintable.NewWriter(htmlPart)
		qp.Write([]byte(htmlBody))
		qp.Close()
	}

	mw.Close()

	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", sanitizeHeaderValue(from))
	fmt.Fprintf(&b, "To: %s\r\n", sanitizeHeaderValue(strings.Join(recipients, ", ")))
	fmt.Fprintf(&b, "Subject: %s\r\n", sanitizeHeaderValue(subject))
	b.WriteString("MIME-Version: 1.0\r\n")
	fmt.Fprintf(&b, "Content-Type: multipart/alternative; boundary=%q\r\n", mw.Boundary())
	b.WriteString("\r\n")
	b.WriteString(parts.String())
	return []byte(b.String())
}

func sanitizeHeaderValue(v string) string {
	v = strings.ReplaceAll(v, "\r", "")
	return strings.ReplaceAll(v, "\n", "")
}
