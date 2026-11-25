package user

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alango/internal/upload"
)

func TestRegisterInputValidation(t *testing.T) {
	h := NewUserHandler(nil, "secret-secret-secret-secret-32chars", nil, upload.NewService(t.TempDir(), "http://localhost:8092/uploads"), nil, nil, nil, "", false, nil, nil)

	cases := []struct {
		name string
		body string
	}{
		{"long phone", `{"full_name":"Test","email":"a@b.com","password":"Password1!","phone":"` + strings.Repeat("1", 51) + `"}`},
		{"long city", `{"full_name":"Test","email":"a@b.com","password":"Password1!","city":"` + strings.Repeat("a", 101) + `"}`},
		{"javascript photo", `{"full_name":"Test","email":"a@b.com","password":"Password1!","photo":"javascript:alert(1)"}`},
		{"own upload photo", `{"full_name":"Test","email":"a@b.com","password":"Password1!","photo":"http://localhost:8092/uploads/stolen.jpg"}`},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodPost, "/api/register", bytes.NewBufferString(tc.body))
		rec := httptest.NewRecorder()
		h.Register(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400 (%s)", tc.name, rec.Code, rec.Body.String())
		}
	}
}
