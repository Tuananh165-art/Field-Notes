package api

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type resetClaims struct {
	Purpose string `json:"purpose"`
	Nonce   string `json:"nonce"`
	jwt.RegisteredClaims
}

func resetKey(secret []byte, hash string) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte("field-notes-password-reset\x00" + hash))
	return mac.Sum(nil)
}

func issueResetCode(id, hash string, secret []byte) (string, error) {
	var nonce [32]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return "", err
	}
	now := time.Now()
	value := resetClaims{Purpose: "password-reset", Nonce: base64.RawURLEncoding.EncodeToString(nonce[:]), RegisteredClaims: jwt.RegisteredClaims{Subject: id, Issuer: "field-notes-api", Audience: jwt.ClaimStrings{"password-reset"}, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute))}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, value).SignedString(resetKey(secret, hash))
}

func resetSubject(raw string) (string, error) {
	if len(raw) == 0 || len(raw) > 2048 {
		return "", errors.New("invalid reset code")
	}
	value := &resetClaims{}
	_, _, err := new(jwt.Parser).ParseUnverified(raw, value)
	if err != nil || value.Subject == "" || len(value.Subject) > 128 {
		return "", errors.New("invalid reset code")
	}
	return value.Subject, nil
}

func verifyResetCode(raw, id, hash string, secret []byte) error {
	value := &resetClaims{}
	token, err := jwt.ParseWithClaims(raw, value, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return resetKey(secret, hash), nil
	}, jwt.WithIssuer("field-notes-api"), jwt.WithAudience("password-reset"), jwt.WithExpirationRequired())
	if err != nil || !token.Valid || value.Subject != id || value.Purpose != "password-reset" || value.Nonce == "" {
		return errors.New("invalid reset code")
	}
	return nil
}

type resetLimitEntry struct {
	count int
	until time.Time
}
type resetLimiter struct {
	mu      sync.Mutex
	entries map[string]resetLimitEntry
}

func newResetLimiter() *resetLimiter { return &resetLimiter{entries: make(map[string]resetLimitEntry)} }
func (l *resetLimiter) allow(key string, limit int, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, entry := range l.entries {
		if !now.Before(entry.until) {
			delete(l.entries, k)
		}
	}
	entry, exists := l.entries[key]
	if !exists {
		if len(l.entries) >= 10000 {
			return false
		}
		entry = resetLimitEntry{until: now.Add(15 * time.Minute)}
	}
	if entry.count >= limit {
		return false
	}
	entry.count++
	l.entries[key] = entry
	return true
}

func remoteIP(c *gin.Context) string {
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return host
}

func (a *API) requestPasswordReset(c *gin.Context) {
	if !smtpConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "password reset email is not configured"})
		return
	}
	var input struct {
		Email string `json:"email"`
	}
	if c.ShouldBindJSON(&input) != nil || len(input.Email) > 254 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	key := sha256.Sum256([]byte(email))
	now := time.Now()
	if !a.resetLimits.allow("request-ip:"+remoteIP(c), 5, now) || !a.resetLimits.allow("request-email:"+hex.EncodeToString(key[:]), 5, now) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "please try again later"})
		return
	}
	address, err := mail.ParseAddress(email)
	if err == nil && address.Address == email {
		var id, hash string
		err = a.db.QueryRowContext(c.Request.Context(), `SELECT id,password_hash FROM users WHERE email=$1`, email).Scan(&id, &hash)
		found := err == nil
		if err == sql.ErrNoRows {
			id, hash = "unregistered", "unregistered-password-hash"
		} else if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "password reset temporarily unavailable"})
			return
		}
		code, codeErr := issueResetCode(id, hash, a.jwtSecret)
		if found && codeErr == nil {
			if a.sendReset != nil {
				a.sendReset(email, code)
			} else {
				queueResetEmail(email, code)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "If the address is registered, a reset email will be sent."})
}

func (a *API) confirmPasswordReset(c *gin.Context) {
	if !a.resetLimits.allow("confirm-ip:"+remoteIP(c), 10, time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "please try again later"})
		return
	}
	var input struct {
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if c.ShouldBindJSON(&input) != nil || len(input.Password) < 8 || len(input.Password) > 72 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid reset request"})
		return
	}
	id, err := resetSubject(strings.TrimSpace(input.Code))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset code"})
		return
	}
	hash, err := a.lookupPasswordHash(c.Request.Context(), id)
	if err != nil || verifyResetCode(strings.TrimSpace(input.Code), id, hash, a.jwtSecret) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset code"})
		return
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reset password"})
		return
	}
	result, err := a.db.ExecContext(c.Request.Context(), `UPDATE users SET password_hash=$1 WHERE id=$2 AND password_hash=$3`, string(newHash), id, hash)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "password reset temporarily unavailable"})
		return
	}
	count, err := result.RowsAffected()
	if err != nil || count != 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset code"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password updated. Please sign in again."})
}
