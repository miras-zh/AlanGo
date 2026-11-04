package router

import (
	"net/http"

	"alango/internal/upload"
)

const maxRequestBodyBytes = upload.MaxUploadSize + 3<<20 // 8MB

func withMaxBodySize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
		next.ServeHTTP(w, r)
	})
}
