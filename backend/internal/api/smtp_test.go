package api

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"math/big"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestSendResetEmailUsesTLSAndDeliversCode(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour), IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}, IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	certificate, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(certificate)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	t.Setenv("SMTP_HOST", "127.0.0.1")
	t.Setenv("SMTP_PORT", strconv.Itoa(listener.Addr().(*net.TCPAddr).Port))
	t.Setenv("SMTP_USERNAME", "sender@example.com")
	t.Setenv("SMTP_PASSWORD", "test-app-password")
	t.Setenv("SMTP_FROM", "sender@example.com")

	result := make(chan error, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			result <- err
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
		reader := bufio.NewReader(conn)
		write := func(message string) error { _, err := fmt.Fprint(conn, message); return err }
		read := func(prefix string) (string, error) {
			line, err := reader.ReadString('\n')
			if err != nil {
				return "", err
			}
			if !strings.HasPrefix(line, prefix) {
				return "", fmt.Errorf("unexpected SMTP command, expected %s", prefix)
			}
			return line, nil
		}
		if err = write("220 localhost ready\r\n"); err != nil {
			result <- err
			return
		}
		if _, err = read("EHLO "); err != nil {
			result <- err
			return
		}
		if err = write("250-localhost\r\n250-STARTTLS\r\n250 AUTH PLAIN\r\n"); err != nil {
			result <- err
			return
		}
		if _, err = read("STARTTLS"); err != nil {
			result <- err
			return
		}
		if err = write("220 begin TLS\r\n"); err != nil {
			result <- err
			return
		}
		secure := tls.Server(conn, &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}, MinVersion: tls.VersionTLS12})
		if err = secure.Handshake(); err != nil {
			result <- err
			return
		}
		conn = secure
		reader = bufio.NewReader(conn)
		if _, err = read("EHLO "); err != nil {
			result <- err
			return
		}
		if err = write("250-localhost\r\n250-8BITMIME\r\n250 AUTH PLAIN\r\n"); err != nil {
			result <- err
			return
		}
		auth, err := read("AUTH PLAIN ")
		if err != nil {
			result <- err
			return
		}
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(strings.TrimPrefix(auth, "AUTH PLAIN ")))
		if err != nil || string(decoded) != "\x00sender@example.com\x00test-app-password" {
			result <- fmt.Errorf("unexpected SMTP authentication")
			return
		}
		if err = write("235 authenticated\r\n"); err != nil {
			result <- err
			return
		}
		if _, err = read("MAIL FROM:"); err != nil {
			result <- err
			return
		}
		if err = write("250 ok\r\n"); err != nil {
			result <- err
			return
		}
		if _, err = read("RCPT TO:"); err != nil {
			result <- err
			return
		}
		if err = write("250 ok\r\n"); err != nil {
			result <- err
			return
		}
		if _, err = read("DATA"); err != nil {
			result <- err
			return
		}
		if err = write("354 send data\r\n"); err != nil {
			result <- err
			return
		}
		var body strings.Builder
		for {
			line, readErr := reader.ReadString('\n')
			if readErr != nil {
				result <- readErr
				return
			}
			if line == ".\r\n" {
				break
			}
			body.WriteString(line)
		}
		if !strings.Contains(body.String(), "To: recipient@example.com") || !strings.Contains(body.String(), "test-reset-code") {
			result <- fmt.Errorf("missing recipient or reset code")
			return
		}
		if err = write("250 accepted\r\n"); err != nil {
			result <- err
			return
		}
		if _, err = read("QUIT"); err != nil {
			result <- err
			return
		}
		result <- write("221 goodbye\r\n")
	}()

	if err := sendResetEmailWithRoots("recipient@example.com", "test-reset-code", roots); err != nil {
		t.Fatal(err)
	}
	if err := <-result; err != nil {
		t.Fatal(err)
	}
}
