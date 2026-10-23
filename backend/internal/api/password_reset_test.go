package api

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func TestResetCodeExpiresAndIsBoundToPassword(t *testing.T) {
	secret := []byte(strings.Repeat("s", 32))
	code, err := issueResetCode("user-1", "old-hash", secret)
	if err != nil {
		t.Fatal(err)
	}
	if id, err := resetSubject(code); err != nil || id != "user-1" {
		t.Fatalf("subject=%q error=%v", id, err)
	}
	if err := verifyResetCode(code, "user-1", "old-hash", secret); err != nil {
		t.Fatal(err)
	}
	if verifyResetCode(code, "user-1", "new-hash", secret) == nil {
		t.Fatal("code remained valid after password changed")
	}
	if _, err := parseToken(code, secret); err == nil {
		t.Fatal("reset code accepted as an access token")
	}
	old := resetClaims{Purpose: "password-reset", Nonce: "nonce", RegisteredClaims: jwt.RegisteredClaims{Subject: "user-1", Issuer: "field-notes-api", Audience: jwt.ClaimStrings{"password-reset"}, ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute))}}
	expired, err := jwt.NewWithClaims(jwt.SigningMethodHS256, old).SignedString(resetKey(secret, "old-hash"))
	if err != nil {
		t.Fatal(err)
	}
	if verifyResetCode(expired, "user-1", "old-hash", secret) == nil {
		t.Fatal("expired code accepted")
	}
}

type resetTestState struct {
	mu   sync.Mutex
	hash string
}

var resetTestStates sync.Map
var registerResetDriver sync.Once

type resetTestDriver struct{}
type resetTestConn struct{ state *resetTestState }
type resetTestRows struct {
	values  []driver.Value
	columns []string
	done    bool
}

func (resetTestDriver) Open(name string) (driver.Conn, error) {
	value, ok := resetTestStates.Load(name)
	if !ok {
		return nil, errors.New("unknown test database")
	}
	return &resetTestConn{state: value.(*resetTestState)}, nil
}
func (*resetTestConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("unsupported") }
func (*resetTestConn) Close() error                        { return nil }
func (*resetTestConn) Begin() (driver.Tx, error)           { return nil, errors.New("unsupported") }
func (c *resetTestConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if len(args) != 1 {
		return nil, errors.New("unexpected query")
	}
	c.state.mu.Lock()
	defer c.state.mu.Unlock()
	if strings.Contains(query, "SELECT password_hash FROM users WHERE id") && args[0].Value == "user-1" {
		return &resetTestRows{columns: []string{"password_hash"}, values: []driver.Value{c.state.hash}}, nil
	}
	if strings.Contains(query, "SELECT id,password_hash FROM users WHERE email") {
		rows := &resetTestRows{columns: []string{"id", "password_hash"}}
		if args[0].Value == "known@example.com" {
			rows.values = []driver.Value{"user-1", c.state.hash}
		} else {
			rows.done = true
		}
		return rows, nil
	}
	return nil, errors.New("unexpected query")
}
func (c *resetTestConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	if !strings.Contains(query, "UPDATE users SET password_hash") || len(args) != 3 {
		return nil, errors.New("unexpected update")
	}
	c.state.mu.Lock()
	defer c.state.mu.Unlock()
	if args[1].Value != "user-1" || args[2].Value != c.state.hash {
		return driver.RowsAffected(0), nil
	}
	c.state.hash = args[0].Value.(string)
	return driver.RowsAffected(1), nil
}
func (r *resetTestRows) Columns() []string { return r.columns }
func (*resetTestRows) Close() error        { return nil }
func (r *resetTestRows) Next(values []driver.Value) error {
	if r.done {
		return io.EOF
	}
	copy(values, r.values)
	r.done = true
	return nil
}

func TestResetRequestDoesNotRevealAccountAndIsRateLimited(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("SMTP_USERNAME", "sender@example.com")
	t.Setenv("SMTP_PASSWORD", "test-app-password")
	t.Setenv("SMTP_FROM", "sender@example.com")
	registerResetDriver.Do(func() { sql.Register("fieldnotes-reset-test", resetTestDriver{}) })
	state := &resetTestState{hash: "test-hash"}
	resetTestStates.Store(t.Name(), state)
	defer resetTestStates.Delete(t.Name())
	db, err := sql.Open("fieldnotes-reset-test", t.Name())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	secret := []byte(strings.Repeat("s", 32))
	var sentTo, sentCode string
	a := &API{db: db, jwtSecret: secret, resetLimits: newResetLimiter(), sendReset: func(email, code string) { sentTo, sentCode = email, code }}
	router := gin.New()
	router.POST("/request", a.requestPasswordReset)
	request := func(email string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"email": email})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/request", strings.NewReader(string(body))))
		return response
	}
	known, unknown := request("known@example.com"), request("unknown@example.com")
	if known.Code != http.StatusOK || unknown.Code != http.StatusOK || known.Body.String() != unknown.Body.String() {
		t.Fatalf("responses differ: %d %s / %d %s", known.Code, known.Body.String(), unknown.Code, unknown.Body.String())
	}
	if sentTo != "known@example.com" || verifyResetCode(sentCode, "user-1", state.hash, secret) != nil || strings.Contains(known.Body.String(), sentCode) {
		t.Fatal("reset email was not isolated from the public response")
	}
	for i := 0; i < 3; i++ {
		if response := request("unknown@example.com"); response.Code != http.StatusOK {
			t.Fatalf("unexpected status %d", response.Code)
		}
	}
	if response := request("unknown@example.com"); response.Code != http.StatusTooManyRequests {
		t.Fatalf("rate limit status=%d", response.Code)
	}
}

func TestPasswordResetIsAtomicAndRevokesPreviousSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	registerResetDriver.Do(func() { sql.Register("fieldnotes-reset-test", resetTestDriver{}) })
	hash, err := bcrypt.GenerateFromPassword([]byte("old-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	state := &resetTestState{hash: string(hash)}
	resetTestStates.Store(t.Name(), state)
	defer resetTestStates.Delete(t.Name())
	db, err := sql.Open("fieldnotes-reset-test", t.Name())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	secret := []byte(strings.Repeat("s", 32))
	a := &API{db: db, jwtSecret: secret, resetLimits: newResetLimiter()}
	code, err := issueResetCode("user-1", state.hash, secret)
	if err != nil {
		t.Fatal(err)
	}
	access, err := issueToken("user-1", secret, state.hash)
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.POST("/reset", a.confirmPasswordReset)
	router.GET("/protected", a.authenticate(), func(c *gin.Context) { c.Status(http.StatusOK) })
	protected := func(token string) int {
		request := httptest.NewRequest(http.MethodGet, "/protected", nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response.Code
	}
	if got := protected(access); got != http.StatusOK {
		t.Fatalf("old session before reset=%d", got)
	}
	body, _ := json.Marshal(map[string]string{"code": code, "password": "new-password"})
	statuses := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/reset", strings.NewReader(string(body))))
			statuses <- response.Code
		}()
	}
	wg.Wait()
	close(statuses)
	counts := map[int]int{}
	for status := range statuses {
		counts[status]++
	}
	if counts[http.StatusOK] != 1 || counts[http.StatusBadRequest] != 1 {
		t.Fatalf("concurrent reset statuses: %v", counts)
	}
	if got := protected(access); got != http.StatusUnauthorized {
		t.Fatalf("old session after reset=%d", got)
	}
	state.mu.Lock()
	newHash := state.hash
	state.mu.Unlock()
	if bcrypt.CompareHashAndPassword([]byte(newHash), []byte("new-password")) != nil {
		t.Fatal("password was not updated")
	}
	newAccess, err := issueToken("user-1", secret, newHash)
	if err != nil {
		t.Fatal(err)
	}
	if got := protected(newAccess); got != http.StatusOK {
		t.Fatalf("new session after reset=%d", got)
	}
}
