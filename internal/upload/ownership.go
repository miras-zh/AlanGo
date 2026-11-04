package upload

import (
	"net/http"
	"os"
	"strings"
)

func (s *Service) IsOwnUpload(url string) bool {
	return strings.HasPrefix(url, s.PublicURL+"/")
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
