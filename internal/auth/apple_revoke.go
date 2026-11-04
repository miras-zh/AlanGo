package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const appleAPIBase = "https://appleid.apple.com"

var ErrAppleTokenAPINotConfigured = errors.New("apple token api is not configured")

func (v *AppleVerifier) ConfigureTokenAPI(teamID, keyID, privateKeyPEM string) {
	if teamID == "" || keyID == "" || privateKeyPEM == "" {
		return
	}
	key, err := jwt.ParseECPrivateKeyFromPEM([]byte(strings.ReplaceAll(privateKeyPEM, `\n`, "\n")))
	if err != nil {
		log.Println("apple: APPLE_PRIVATE_KEY does not parse, token revocation disabled:", err)
		return
	}
	v.teamID, v.keyID, v.tokenKey = teamID, keyID, key
	if v.apiBase == "" {
		v.apiBase = appleAPIBase
	}
}

func (v *AppleVerifier) TokenAPIEnabled() bool {
	return v.tokenKey != nil && len(v.audiences) > 0
}

func (v *AppleVerifier) clientSecret() (string, error) {
	now := time.Now()
	tok := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"iss": v.teamID,
		"iat": now.Unix(),
		"exp": now.Add(5 * time.Minute).Unix(),
		"aud": appleAPIBase,
		"sub": v.audiences[0],
	})
	tok.Header["kid"] = v.keyID
	return tok.SignedString(v.tokenKey)
}

func (v *AppleVerifier) postForm(ctx context.Context, path string, form url.Values) (*http.Response, error) {
	secret, err := v.clientSecret()
	if err != nil {
		return nil, err
	}
	form.Set("client_id", v.audiences[0])
	form.Set("client_secret", secret)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.apiBase+path, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return v.http.Do(req)
}

func (v *AppleVerifier) ExchangeCode(ctx context.Context, code string) (string, error) {
	if !v.TokenAPIEnabled() {
		return "", ErrAppleTokenAPINotConfigured
	}
	res, err := v.postForm(ctx, "/auth/token", url.Values{
		"code":       {code},
		"grant_type": {"authorization_code"},
	})
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("apple /auth/token: status %d", res.StatusCode)
	}
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return "", err
	}
	if body.RefreshToken == "" {
		return "", errors.New("apple /auth/token: no refresh_token in response")
	}
	return body.RefreshToken, nil
}

func (v *AppleVerifier) RevokeToken(ctx context.Context, refreshToken string) error {
	if !v.TokenAPIEnabled() {
		return ErrAppleTokenAPINotConfigured
	}
	res, err := v.postForm(ctx, "/auth/revoke", url.Values{
		"token":           {refreshToken},
		"token_type_hint": {"refresh_token"},
	})
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("apple /auth/revoke: status %d", res.StatusCode)
	}
	return nil
}
