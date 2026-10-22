package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestIssueAndParseTokenRoundTrip(t *testing.T) {
	secret := []byte(strings.Repeat("s", 32))
	raw, err := issueToken("user-123", secret, "test-password-hash")
	if err != nil {
		t.Fatalf("issueToken() error = %v", err)
	}

	got, err := parseToken(raw, secret)
	if err != nil {
		t.Fatalf("parseToken() error = %v", err)
	}
	if got != "user-123" {
		t.Fatalf("parseToken() subject = %q, want %q", got, "user-123")
	}
}

func TestParseTokenRejectsInvalidTokens(t *testing.T) {
	secret := []byte(strings.Repeat("s", 32))
	otherSecret := []byte(strings.Repeat("x", 32))
	now := time.Now()

	newToken := func(method jwt.SigningMethod, tokenClaims claims, signingKey []byte) string {
		t.Helper()
		raw, err := jwt.NewWithClaims(method, tokenClaims).SignedString(signingKey)
		if err != nil {
			t.Fatalf("SignedString() error = %v", err)
		}
		return raw
	}

	tests := []struct {
		name string
		raw  string
		key  []byte
	}{
		{
			name: "wrong signing secret",
			raw:  newToken(jwt.SigningMethodHS256, claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "user-123", Issuer: "field-notes-api", IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, otherSecret),
			key:  secret,
		},
		{
			name: "expired token",
			raw:  newToken(jwt.SigningMethodHS256, claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "user-123", Issuer: "field-notes-api", IssuedAt: jwt.NewNumericDate(now.Add(-2 * time.Hour)), ExpiresAt: jwt.NewNumericDate(now.Add(-time.Hour))}}, secret),
			key:  secret,
		},
		{
			name: "wrong issuer",
			raw:  newToken(jwt.SigningMethodHS256, claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "user-123", Issuer: "other-service", IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, secret),
			key:  secret,
		},
		{
			name: "unsupported signing algorithm",
			raw:  newToken(jwt.SigningMethodHS384, claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "user-123", Issuer: "field-notes-api", IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour))}}, secret),
			key:  secret,
		},
		{
			name: "missing expiration",
			raw:  newToken(jwt.SigningMethodHS256, claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "user-123", Issuer: "field-notes-api", IssuedAt: jwt.NewNumericDate(now)}}, secret),
			key:  secret,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if subject, err := parseToken(tt.raw, tt.key); err == nil {
				t.Fatalf("parseToken() = (%q, nil), want an error", subject)
			}
		})
	}
}

func TestAuthenticateMiddlewareProtectsRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := []byte(strings.Repeat("s", 32))
	raw, err := issueToken("user-123", secret, "test-password-hash")
	if err != nil {
		t.Fatalf("issueToken() error = %v", err)
	}

	tests := []struct {
		name       string
		authorize  string
		wantStatus int
		wantBody   string
	}{
		{name: "missing bearer token", wantStatus: http.StatusUnauthorized},
		{name: "invalid bearer token", authorize: "Bearer invalid", wantStatus: http.StatusUnauthorized},
		{name: "valid bearer token", authorize: "Bearer " + raw, wantStatus: http.StatusOK, wantBody: "user-123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			api := &API{jwtSecret: secret, passwordHash: func(context.Context, string) (string, error) { return "test-password-hash", nil }}
			router.GET("/protected", api.authenticate(), func(c *gin.Context) {
				c.String(http.StatusOK, currentUser(c))
			})
			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			if tt.authorize != "" {
				req.Header.Set("Authorization", tt.authorize)
			}
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)

			if res.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body=%s", res.Code, tt.wantStatus, res.Body.String())
			}
			if tt.wantBody != "" && res.Body.String() != tt.wantBody {
				t.Fatalf("body = %q, want %q", res.Body.String(), tt.wantBody)
			}
		})
	}
}
