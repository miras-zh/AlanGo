package upload

import (
	"net/http"
	"net/url"
	"os"
	"strings"
)

func (s *Service) IsOwnUpload(u string) bool {
	return s != nil && s.PublicURL != "" && strings.HasPrefix(u, s.PublicURL+"/")
}

// IsValidExternalImageURL accepts empty strings or http(s) URLs with a valid host,
// rejecting dangerous schemes (javascript:, data:, file:) and local upload paths.
func (s *Service) IsValidExternalImageURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return true
	}
	if s != nil && (s.IsOwnUpload(raw) || strings.HasPrefix(raw, "/uploads/")) {
		return false
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	scheme := strings.ToLower(parsed.Scheme)
	return (scheme == "http" || scheme == "https") && parsed.Host != ""
}

// NoListingFS serves files from dir but reports every directory as missing,
// so GET /uploads/ answers 404 instead of auto-generating a directory listing.
type NoListingFS struct{ http.FileSystem }

func (fs NoListingFS) Open(name string) (http.File, error) {
	f, err := fs.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	info, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return nil, err
	}
	if info.IsDir() {
		_ = f.Close()
		return nil, os.ErrNotExist
	}
	return f, nil
}
