package upload

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const MaxUploadSize = 5 << 20 // 5MB

var (
	ErrFileTooLarge = errors.New("file exceeds the maximum upload size of 5MB")
	ErrInvalidType  = errors.New("file must be a JPEG, PNG or WebP image")
)

var allowedExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type Service struct {
	Dir       string
	PublicURL string
}

func NewService(dir, publicURL string) *Service {
	return &Service{Dir: dir, PublicURL: publicURL}
}

func (s *Service) SaveImage(file multipart.File, header *multipart.FileHeader) (string, error) {
	if header.Size > MaxUploadSize {
		return "", ErrFileTooLarge
	}

	head := make([]byte, 512)
	n, err := file.Read(head)
	if err != nil && err != io.EOF {
		return "", err
	}
	contentType := http.DetectContentType(head[:n])

	ext, ok := allowedExtensions[contentType]
	if !ok {
		return "", ErrInvalidType
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return "", err
	}

	name, err := randomFilename(ext)
	if err != nil {
		return "", err
	}

	dst, err := os.Create(filepath.Join(s.Dir, name))
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", err
	}

	return s.PublicURL + "/" + name, nil
}

func (s *Service) DeleteImage(url string) error {
	prefix := s.PublicURL + "/"
	if !strings.HasPrefix(url, prefix) {
		return nil
	}

	name := strings.TrimPrefix(url, prefix)
	if name == "" || strings.ContainsAny(name, "/\\") {
		return nil
	}

	err := os.Remove(filepath.Join(s.Dir, name))
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func randomFilename(ext string) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b) + ext, nil
}
