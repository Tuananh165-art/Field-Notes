package api

import (
	"database/sql"
	"net/http"
	"net/mail"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type credentials struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (a *API) register(c *gin.Context) {
	var input credentials
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	address, addressErr := mail.ParseAddress(input.Email)
	if addressErr != nil || address.Address != input.Email || len(input.Password) < 8 || len(input.Password) > 72 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid email and password of 8 to 72 bytes are required"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}
	id, err := newID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}
	_, err = a.db.ExecContext(c, `INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)`, id, input.Email, string(hash))
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email is already registered"})
		return
	}
	token, err := issueToken(id, a.jwtSecret, string(hash))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": gin.H{"id": id, "email": input.Email}})
}
func (a *API) login(c *gin.Context) {
	var input credentials
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	var id, hash string
	err := a.db.QueryRowContext(c, `SELECT id,password_hash FROM users WHERE email=$1`, input.Email).Scan(&id, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "email or password is incorrect"})
		return
	}
	token, err := issueToken(id, a.jwtSecret, hash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": gin.H{"id": id, "email": input.Email}})
}

func Migrate(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE TABLE IF NOT EXISTS notes (
		id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'synced',
		created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, photo_uri TEXT,
		lat DOUBLE PRECISION, lng DOUBLE PRECISION, version INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY(user_id,id)
	);
	CREATE INDEX IF NOT EXISTS notes_user_created_idx ON notes(user_id,created_at DESC);`)
	return err
}
