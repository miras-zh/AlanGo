package mail

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"log"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
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
		cfg.SiteURL = "http://localhost:3000"
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
	return s.deliver(recipients, buildMessage(s.cfg.From, subject, body))
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
	return s.deliver(recipients, buildMultipartMessage(s.cfg.From, subject, plain, html))
}

func (s *Sender) deliver(recipients []string, msg []byte) error {
	addr := s.cfg.Host + ":" + s.cfg.Port
	auth := smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)

	if s.cfg.Port == "465" {
		return sendMailTLS(addr, s.cfg.Host, auth, s.cfg.From, recipients, msg)
	}
	return sendMailPlain(addr, s.cfg.Host, auth, s.cfg.From, recipients, msg)
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

	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: host}); err != nil {
			return fmt.Errorf("mail: starttls: %w", err)
		}
	}
	if auth != nil {
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

	if err := c.Auth(auth); err != nil {
		return fmt.Errorf("mail: auth: %w", err)
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

func buildMessage(from, subject, body string) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", sanitizeHeaderValue(from))
	fmt.Fprintf(&b, "Subject: %s\r\n", sanitizeHeaderValue(subject))
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=\"utf-8\"\r\n")
	b.WriteString("\r\n")
	b.WriteString(body)
	return []byte(b.String())
}

func buildMultipartMessage(from, subject, plainBody, htmlBody string) []byte {
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
