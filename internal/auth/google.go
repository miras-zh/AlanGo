package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var (
	ErrGoogleNotConfigured = errors.New("google sign-in is not configured")
	ErrInvalidGoogleToken  = errors.New("invalid google token")
	ErrGoogleUnavailable   = errors.New("google token verification unavailable")
)

const maxIDTokenLen = 4096

type GoogleIdentity struct {
	Sub     string
	Email   string
	Name    string
	Picture string
}

type GoogleVerifier struct {
	clientIDs []string
	http      *http.Client
}

func NewGoogleVerifier(clientIDs string) *GoogleVerifier {
	var ids []string
	for _, id := range strings.Split(clientIDs, ",") {
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}
	return &GoogleVerifier{
		clientIDs: ids,
		http:      &http.Client{Timeout: 5 * time.Second},
	}
}

func (v *GoogleVerifier) Enabled() bool {
	return len(v.clientIDs) > 0
}

type tokenInfoResponse struct {
	Aud           string `json:"aud"`
	Iss           string `json:"iss"`
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Exp           string `json:"exp"`
}

func (v *GoogleVerifier) Verify(ctx context.Context, idToken string) (*GoogleIdentity, error) {
	if !v.Enabled() {
		return nil, ErrGoogleNotConfigured
	}
	if idToken == "" || len(idToken) > maxIDTokenLen {
		return nil, ErrInvalidGoogleToken
	}

	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}

	res, err := v.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusBadRequest {
		return nil, ErrInvalidGoogleToken
	}
	if res.StatusCode != http.StatusOK {
		return nil, ErrGoogleUnavailable
	}

	var info tokenInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&info); err != nil {
		return nil, ErrInvalidGoogleToken
	}

	if !v.audienceAllowed(info.Aud) {
		return nil, ErrInvalidGoogleToken
	}

	if info.Iss != "accounts.google.com" && info.Iss != "https://accounts.google.com" {
		return nil, ErrInvalidGoogleToken
	}

	exp, err := strconv.ParseInt(info.Exp, 10, 64)
	if err != nil || time.Unix(exp, 0).Before(time.Now()) {
		return nil, ErrInvalidGoogleToken
	}

	if info.Email == "" || info.EmailVerified != "true" {
		return nil, ErrInvalidGoogleToken
	}

	if info.Sub == "" {
		return nil, ErrInvalidGoogleToken
	}

	return &GoogleIdentity{
		Sub:     info.Sub,
		Email:   info.Email,
		Name:    info.Name,
		Picture: info.Picture,
	}, nil
}

func (v *GoogleVerifier) audienceAllowed(aud string) bool {
	for _, id := range v.clientIDs {
		if id == aud {
			return true
		}
	}
	return false
}
