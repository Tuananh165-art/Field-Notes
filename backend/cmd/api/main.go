package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"fieldnotes/backend/internal/api"
	_ "github.com/lib/pq"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	secret := os.Getenv("JWT_SECRET")
	if dsn == "" || len(secret) < 32 {
		log.Fatal("DATABASE_URL and a JWT_SECRET of at least 32 characters are required")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.Ping(); err != nil {
		log.Fatal("database is unavailable: ", err)
	}
	if err := api.Migrate(db); err != nil {
		log.Fatal("database migration failed: ", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	router := api.NewRouter(db, []byte(secret), os.Getenv("CORS_ORIGINS"))
	server := &http.Server{Addr: ":" + port, Handler: router, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("Field Notes API listening on :%s", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
