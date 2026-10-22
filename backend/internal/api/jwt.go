package api

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type claims struct {
	PasswordVersion string `json:"pv"`
	jwt.RegisteredClaims
}

func passwordVersion(secret []byte, hash string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte("field-notes-access-version\x00" + hash))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func issueToken(id string, secret []byte, hash string) (string, error) {
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{PasswordVersion: passwordVersion(secret, hash), RegisteredClaims: jwt.RegisteredClaims{Subject: id, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)), Issuer: "field-notes-api"}})
	return token.SignedString(secret)
}
func parseTokenClaims(raw string, secret []byte) (*claims, error) {
	token, err := jwt.ParseWithClaims(raw, &claims{}, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	}, jwt.WithIssuer("field-notes-api"), jwt.WithExpirationRequired())
	if err != nil {
		return nil, err
	}
	value, ok := token.Claims.(*claims)
	if !ok || !token.Valid || value.Subject == "" {
		return nil, errors.New("invalid token claims")
	}
	return value, nil
}
func parseToken(raw string, secret []byte) (string, error) {
	value, err := parseTokenClaims(raw, secret)
	if err != nil {
		return "", err
	}
	return value.Subject, nil
}
func newID() (string, error) {
	var data [16]byte
	if _, err := rand.Read(data[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(data[:]), nil
}
