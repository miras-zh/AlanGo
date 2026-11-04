package audit

import (
	"log"
	"net"
	"net/http"
	"strings"

	"alango/internal/safego"

	"gorm.io/gorm"
)

var MaxEntriesPerUser = 1000

type Service struct {
	DB *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{DB: db}
}

func (s *Service) Log(userID uint, action Action, detail string, req *http.Request) {
	if s == nil || s.DB == nil {
		return
	}
	ip := clientIP(req)
	safego.Go(func() {
		entry := Entry{UserID: userID, Action: string(action), Detail: detail, IP: ip}
		if err := s.DB.Create(&entry).Error; err != nil {
			log.Println("audit: failed to write entry:", err)
			return
		}
		s.trim(userID)
	})
}

func clientIP(r *http.Request) string {
	if r == nil {
		return ""
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

func (s *Service) trim(userID uint) {
	err := s.DB.Exec(`
		DELETE FROM audit_log
		WHERE user_id = ?
		AND id NOT IN (
			SELECT id FROM audit_log WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
		)
	`, userID, userID, MaxEntriesPerUser).Error
	if err != nil {
		log.Println("audit: failed to trim entries:", err)
	}
}

func (s *Service) ListForUser(userID uint, page, pageSize int) ([]Entry, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)

	var total int64
	if err := s.DB.Model(&Entry{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	entries := []Entry{}
	err := s.DB.Where("user_id = ?", userID).
		Order("created_at DESC, id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&entries).Error
	if err != nil {
		return nil, 0, err
	}
	return entries, total, nil
}

func normalizePagination(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}
