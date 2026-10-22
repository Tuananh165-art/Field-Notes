package api

import (
	"context"
	"crypto/hmac"
	"database/sql"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type API struct {
	db           *sql.DB
	jwtSecret    []byte
	passwordHash func(context.Context, string) (string, error)
	resetLimits  *resetLimiter
	sendReset    func(string, string)
}
type contextKey string

const userIDKey contextKey = "userID"

func NewRouter(db *sql.DB, secret []byte, origins string) *gin.Engine {
	if gin.Mode() == gin.DebugMode && os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	a := &API{db: db, jwtSecret: secret, resetLimits: newResetLimiter()}
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8<<20); c.Next() })
	r.Use(gin.Logger(), gin.Recovery(), cors(origins))
	r.GET("/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	v1 := r.Group("/api/v1")
	v1.POST("/auth/register", a.register)
	v1.POST("/auth/login", a.login)
	v1.POST("/auth/password-reset/request", a.requestPasswordReset)
	v1.POST("/auth/password-reset/confirm", a.confirmPasswordReset)
	protected := v1.Group("")
	protected.Use(a.authenticate())
	protected.GET("/notes", a.listNotes)
	protected.GET("/notes/:id", a.getNote)
	protected.POST("/notes/sync", a.syncNote)
	return r
}

func cors(origins string) gin.HandlerFunc {
	allowed := strings.TrimSpace(origins)
	if allowed == "" {
		allowed = "*"
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowed == "*" || origin == allowed {
			c.Header("Access-Control-Allow-Origin", func() string {
				if allowed == "*" {
					return "*"
				}
				return origin
			}())
		}
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func (a *API) authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "bearer token required"})
			c.Abort()
			return
		}
		value, err := parseTokenClaims(strings.TrimPrefix(header, "Bearer "), a.jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}
		hash, err := a.lookupPasswordHash(c.Request.Context(), value.Subject)
		if err != nil && err != sql.ErrNoRows {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "authentication unavailable"})
			c.Abort()
			return
		}
		if err != nil || value.PasswordVersion == "" || !hmac.Equal([]byte(value.PasswordVersion), []byte(passwordVersion(a.jwtSecret, hash))) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}
		c.Set(string(userIDKey), value.Subject)
		c.Next()
	}
}

func (a *API) lookupPasswordHash(ctx context.Context, id string) (string, error) {
	if a.passwordHash != nil {
		return a.passwordHash(ctx, id)
	}
	var hash string
	err := a.db.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id=$1`, id).Scan(&hash)
	return hash, err
}

func currentUser(c *gin.Context) string {
	value, _ := c.Get(string(userIDKey))
	id, _ := value.(string)
	return id
}
func (a *API) listNotes(c *gin.Context) {
	rows, err := a.db.QueryContext(c, `SELECT id,title,body,status,created_at,updated_at,photo_uri,lat,lng,version FROM notes WHERE user_id=$1 ORDER BY created_at DESC`, currentUser(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load notes"})
		return
	}
	defer rows.Close()
	notes := make([]Note, 0)
	for rows.Next() {
		var n Note
		if err := rows.Scan(&n.ID, &n.Title, &n.Body, &n.Status, &n.CreatedAt, &n.UpdatedAt, &n.PhotoURI, &n.Lat, &n.Lng, &n.Version); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read notes"})
			return
		}
		notes = append(notes, n)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read notes"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"notes": notes})
}
func (a *API) getNote(c *gin.Context) {
	note, err := findNote(c, a.db, currentUser(c), c.Param("id"))
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load note"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"note": note})
}
