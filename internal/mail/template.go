package mail

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"strings"
	"time"
)

//go:embed templates/notification.html
var notificationTemplateSrc string

var notificationTmpl = template.Must(template.New("notification").Parse(notificationTemplateSrc))

type TemplateData struct {
	Brand      string
	SiteURL    string
	Title      string
	Name       string
	Message    string
	Highlight  string
	ButtonURL  string
	ButtonText string
}

type renderData struct {
	Brand      string
	SiteURL    string
	Title      string
	Name       string
	Message    template.HTML
	Highlight  template.HTML
	ButtonURL  string
	ButtonText string
	Year       int
}

func renderNotificationHTML(d TemplateData) (string, error) {
	rd := renderData{
		Brand:      d.Brand,
		SiteURL:    d.SiteURL,
		Title:      d.Title,
		Name:       d.Name,
		Message:    toHTMLLines(d.Message),
		Highlight:  toHTMLLines(d.Highlight),
		ButtonURL:  d.ButtonURL,
		ButtonText: d.ButtonText,
		Year:       time.Now().Year(),
	}
	var buf bytes.Buffer
	if err := notificationTmpl.Execute(&buf, rd); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func toHTMLLines(s string) template.HTML {
	if s == "" {
		return ""
	}
	escaped := template.HTMLEscapeString(s)
	return template.HTML(strings.ReplaceAll(escaped, "\n", "<br>"))
}

func plainTextFallback(d TemplateData) string {
	var b strings.Builder
	if d.Name != "" {
		fmt.Fprintf(&b, "Здравствуйте, %s!\n\n", d.Name)
	}
	b.WriteString(d.Message)
	if d.Highlight != "" {
		fmt.Fprintf(&b, "\n\n%s\n", d.Highlight)
	}
	if d.ButtonURL != "" {
		label := d.ButtonText
		if label == "" {
			label = "Перейти"
		}
		fmt.Fprintf(&b, "\n%s: %s\n", label, d.ButtonURL)
	}
	return b.String()
}
