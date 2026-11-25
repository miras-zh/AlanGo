package upload

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func newMultipartFile(t *testing.T, field, filename string, data []byte) (multipart.File, *multipart.FileHeader) {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, err := w.CreateFormFile(field, filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatal(err)
	}
	_ = w.Close()

	req := httptest.NewRequest("POST", "/", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	f, h, err := req.FormFile(field)
	if err != nil {
		t.Fatal(err)
	}
	return f, h
}

func TestSaveAndValidateImages(t *testing.T) {
	dir := t.TempDir()
	svc := NewService(dir, "http://localhost:8092/uploads")

	// Reject non-image payload even with .jpg filename.
	fBad, hBad := newMultipartFile(t, "photo", "evil.jpg", []byte("<html>not an image</html>"))
	defer fBad.Close()
	if _, err := svc.SaveImage(fBad, hBad); err != ErrInvalidType {
		t.Fatalf("expected ErrInvalidType, got %v", err)
	}

	// Accept valid PNG magic bytes.
	pngBytes := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0}
	fGood, hGood := newMultipartFile(t, "photo", "ok.png", pngBytes)
	defer fGood.Close()
	url, err := svc.SaveImage(fGood, hGood)
	if err != nil {
		t.Fatalf("SaveImage PNG failed: %v", err)
	}
	if !svc.IsOwnUpload(url) {
		t.Fatalf("expected IsOwnUpload=true for %q", url)
	}

	// DeleteImage deletes own file and ignores traversal attempts.
	_ = svc.DeleteImage("http://localhost:8092/uploads/../etc/passwd")
	if err := svc.DeleteImage(url); err != nil {
		t.Fatalf("DeleteImage failed: %v", err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("expected empty upload dir after delete, got %d files", len(entries))
	}

	// URL validation.
	if !svc.IsValidExternalImageURL("") || !svc.IsValidExternalImageURL("https://cdn.example.com/a.jpg") {
		t.Fatalf("expected valid external URLs to pass")
	}
	for _, bad := range []string{"javascript:alert(1)", "/uploads/a.jpg", url, "ftp://example.com/a.jpg"} {
		if svc.IsValidExternalImageURL(bad) {
			t.Errorf("expected %q to be rejected", bad)
		}
	}
	_ = filepath.Clean(dir)
}
