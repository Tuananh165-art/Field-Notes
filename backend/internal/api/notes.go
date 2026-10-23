package api

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Note struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	PhotoURI  *string   `json:"photoUri"`
	Lat       *float64  `json:"lat"`
	Lng       *float64  `json:"lng"`
	Version   int       `json:"version"`
}
type syncRequest struct {
	Note Note `json:"note" binding:"required"`
}
type syncResponse struct {
	Note       Note   `json:"note"`
	Status     string `json:"status"`
	ServerNote *Note  `json:"serverNote,omitempty"`
}

func findNote(c *gin.Context, db *sql.DB, userID, id string) (Note, error) {
	var note Note
	err := db.QueryRowContext(c, `SELECT id,title,body,status,created_at,updated_at,photo_uri,lat,lng,version FROM notes WHERE user_id=$1 AND id=$2`, userID, id).Scan(&note.ID, &note.Title, &note.Body, &note.Status, &note.CreatedAt, &note.UpdatedAt, &note.PhotoURI, &note.Lat, &note.Lng, &note.Version)
	return note, err
}
func (a *API) syncNote(c *gin.Context) {
	var input syncRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid note is required"})
		return
	}
	n := input.Note
	if n.ID == "" || len(n.Title) == 0 || len(n.Title) > 300 || len(n.Body) == 0 || len(n.Body) > 20000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "note id, title and body are required and must be within limits"})
		return
	}
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	if n.UpdatedAt.IsZero() {
		n.UpdatedAt = n.CreatedAt
	}
	n.Status = "synced"
	tx, err := a.db.BeginTx(c, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not begin sync"})
		return
	}
	defer tx.Rollback()
	var current Note
	err = tx.QueryRowContext(c, `SELECT id,title,body,status,created_at,updated_at,photo_uri,lat,lng,version FROM notes WHERE user_id=$1 AND id=$2 FOR UPDATE`, currentUser(c), n.ID).Scan(&current.ID, &current.Title, &current.Body, &current.Status, &current.CreatedAt, &current.UpdatedAt, &current.PhotoURI, &current.Lat, &current.Lng, &current.Version)
	if err == sql.ErrNoRows {
		n.Version = 1
		_, err = tx.ExecContext(c, `INSERT INTO notes(id,user_id,title,body,status,created_at,updated_at,photo_uri,lat,lng,version) VALUES($1,$2,$3,$4,'synced',$5,$6,$7,$8,$9,1)`, n.ID, currentUser(c), n.Title, n.Body, n.CreatedAt, n.UpdatedAt, n.PhotoURI, n.Lat, n.Lng)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save note"})
			return
		}
		if err = tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete sync"})
			return
		}
		c.JSON(http.StatusOK, syncResponse{Note: n, Status: "synced"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load note"})
		return
	}
	if n.Version != current.Version {
		if err = tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete conflict check"})
			return
		}
		c.JSON(http.StatusOK, syncResponse{Note: n, Status: "conflict", ServerNote: &current})
		return
	}
	n.Version = current.Version + 1
	_, err = tx.ExecContext(c, `UPDATE notes SET title=$3,body=$4,status='synced',updated_at=$5,photo_uri=$6,lat=$7,lng=$8,version=$9 WHERE user_id=$1 AND id=$2`, currentUser(c), n.ID, n.Title, n.Body, n.UpdatedAt, n.PhotoURI, n.Lat, n.Lng, n.Version)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update note"})
		return
	}
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete sync"})
		return
	}
	c.JSON(http.StatusOK, syncResponse{Note: n, Status: "synced"})
}
