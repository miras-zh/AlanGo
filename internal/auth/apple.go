package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrAppleNotConfigured = errors.New("sign in with apple is not configured")
	ErrInvalidAppleToken  = errors.New("invalid apple token")
	ErrAppleUnavailable   = errors.New("apple token verification unavailable")
)

const (
	appleIssuer    = "https://appleid.apple.com"
	appleKeysURL   = "https://appleid.apple.com/auth/keys"
	appleKeyMaxAge = time.Hour
	maxAppleTokLen = 8192
)

type AppleClaims struct {
	Sub            string
	Email          string
	EmailVerified  bool
	IsPrivateEmail bool
}

type AppleVerifier struct {
	audiences []string
	http      *http.Client

	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time

	teamID   string
	keyID    string
	tokenKey *ecdsa.PrivateKey
	apiBase  string
}

func NewAppleVerifier(audiences string) *AppleVerifier {
	var ids []string
	for _, id := range strings.Split(audiences, ",") {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	return &AppleVerifier{
		audiences: ids,
		http:      &http.Client{Timeout: 5 * time.Second},
		keys:      map[string]*rsa.PublicKey{},
	}
}

func (v *AppleVerifier) Enabled() bool { return len(v.audiences) > 0 }

type errKeyFetch struct{ err error }

func (e errKeyFetch) Error() string { return "apple key fetch: " + e.err.Error() }

func (v *AppleVerifier) Verify(ctx context.Context, idToken string) (*AppleClaims, error) {
	if !v.Enabled() {
		return nil, ErrAppleNotConfigured
	}
	if idToken == "" || len(idToken) > maxAppleTokLen {
		return nil, ErrInvalidAppleToken
	}

	keyfunc := func(tok *jwt.Token) (any, error) {
		kid, _ := tok.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("no kid in token header")
		}
		key, err := v.keyForKid(ctx, kid)
		if err != nil {
			return nil, errKeyFetch{err}
		}
		return key, nil
	}

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(idToken, claims, keyfunc,
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer(appleIssuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		var kf errKeyFetch
		if errors.As(err, &kf) {
			return nil, ErrAppleUnavailable
		}
		return nil, ErrInvalidAppleToken
	}

	if !v.audienceAllowed(claims) {
		return nil, ErrInvalidAppleToken
	}

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, ErrInvalidAppleToken
	}

	email, _ := claims["email"].(string)

	return &AppleClaims{
		Sub:            sub,
		Email:          email,
		EmailVerified:  appleBoolClaim(claims["email_verified"]),
		IsPrivateEmail: appleBoolClaim(claims["is_private_email"]),
	}, nil
}

func (v *AppleVerifier) audienceAllowed(claims jwt.MapClaims) bool {
	aud, err := claims.GetAudience()
	if err != nil {
		return false
	}
	for _, a := range aud {
		for _, allowed := range v.audiences {
			if a == allowed {
				return true
			}
		}
	}
	return false
}

func appleBoolClaim(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "true"
	default:
		return false
	}
}

func (v *AppleVerifier) keyForKid(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	if k, ok := v.keys[kid]; ok && time.Since(v.fetchedAt) < appleKeyMaxAge {
		v.mu.Unlock()
		return k, nil
	}
	v.mu.Unlock()

	fetched, err := v.fetchKeys(ctx)
	if err != nil {
		v.mu.Lock()
		if k, ok := v.keys[kid]; ok {
			v.mu.Unlock()
			return k, nil
		}
		v.mu.Unlock()
		return nil, err
	}

	v.mu.Lock()
	v.keys = fetched
	v.fetchedAt = time.Now()
	k, ok := v.keys[kid]
	v.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("apple jwks has no key %q", kid)
	}
	return k, nil
}

type appleJWKS struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func (v *AppleVerifier) fetchKeys(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, appleKeysURL, nil)
	if err != nil {
		return nil, err
	}
	res, err := v.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("apple jwks status %d", res.StatusCode)
	}

	var jwks appleJWKS
	if err := json.NewDecoder(res.Body).Decode(&jwks); err != nil {
		return nil, err
	}

	out := make(map[string]*rsa.PublicKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		pub, err := jwkToRSA(k.N, k.E)
		if err != nil {
			continue
		}
		out[k.Kid] = pub
	}
	if len(out) == 0 {
		return nil, errors.New("apple jwks contained no usable RSA keys")
	}
	return out, nil
}

func jwkToRSA(nB64, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, err
	}
	e := new(big.Int).SetBytes(eBytes)
	if !e.IsInt64() || e.Int64() < 2 {
		return nil, errors.New("invalid jwk exponent")
	}
	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: int(e.Int64()),
	}, nil
}
