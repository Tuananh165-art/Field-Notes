package api

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"time"
)

type smtpConfig struct{ host, port, username, password, from string }

func loadSMTPConfig() (smtpConfig, bool) {
	config := smtpConfig{host: os.Getenv("SMTP_HOST"), port: os.Getenv("SMTP_PORT"), username: strings.TrimSpace(os.Getenv("SMTP_USERNAME")), password: os.Getenv("SMTP_PASSWORD"), from: strings.TrimSpace(os.Getenv("SMTP_FROM"))}
	if config.host == "" {
		config.host = "smtp.gmail.com"
	}
	if config.port == "" {
		config.port = "587"
	}
	if config.from == "" {
		config.from = config.username
	}
	from, err := mail.ParseAddress(config.from)
	if err != nil || from.Address != config.from || config.username == "" || config.password == "" {
		return smtpConfig{}, false
	}
	return config, true
}

func smtpConfigured() bool { _, ok := loadSMTPConfig(); return ok }

var resetMailSlots = make(chan struct{}, 4)

func queueResetEmail(recipient, code string) {
	select {
	case resetMailSlots <- struct{}{}:
		go func() {
			defer func() { <-resetMailSlots }()
			if err := sendResetEmail(recipient, code); err != nil {
				log.Print("password reset email delivery failed")
			}
		}()
	default:
		log.Print("password reset email queue is busy")
	}
}

func sendResetEmail(recipient, code string) error {
	return sendResetEmailWithRoots(recipient, code, nil)
}

func sendResetEmailWithRoots(recipient, code string, roots *x509.CertPool) error {
	config, ok := loadSMTPConfig()
	if !ok {
		return errors.New("SMTP is not configured")
	}
	address, err := mail.ParseAddress(recipient)
	if err != nil || address.Address != recipient {
		return errors.New("invalid recipient")
	}
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(config.host, config.port), 10*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()
	if err := conn.SetDeadline(time.Now().Add(15 * time.Second)); err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, config.host)
	if err != nil {
		return err
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); !ok {
		return errors.New("SMTP server does not offer STARTTLS")
	}
	if err := client.StartTLS(&tls.Config{ServerName: config.host, RootCAs: roots, MinVersion: tls.VersionTLS12}); err != nil {
		return err
	}
	if err := client.Auth(smtp.PlainAuth("", config.username, config.password, config.host)); err != nil {
		return err
	}
	if err := client.Mail(config.from); err != nil {
		return err
	}
	if err := client.Rcpt(recipient); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: Field Notes password reset\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\nSao chép mã bên dưới vào màn hình Quên mật khẩu của Field Notes. Mã có hiệu lực trong 15 phút và chỉ dùng một lần.\r\n\r\n%s\r\n\r\nNếu bạn không yêu cầu, hãy bỏ qua email này.\r\n", config.from, recipient, code)
	if _, err := io.WriteString(writer, message); err != nil {
		writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}
