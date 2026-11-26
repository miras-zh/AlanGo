package database

import (
	"strings"
	"testing"

	"alango/config"
)

func TestBuildDSNIncludesTimeouts(t *testing.T) {
	cfg := &config.Config{
		DBHost:     "db",
		DBPort:     "5432",
		DBUser:     "alango_app",
		DBPassword: "secret",
		DBName:     "alango",
		DBSSLMode:  "disable",
	}

	dsn := BuildDSN(cfg)
	for _, want := range []string{
		"host=db",
		"port=5432",
		"user=alango_app",
		"dbname=alango",
		"connect_timeout=5",
		"statement_timeout=15000",
		"lock_timeout=5000",
		"idle_in_transaction_session_timeout=30000",
	} {
		if !strings.Contains(dsn, want) {
			t.Fatalf("expected DSN to contain %q, got %q", want, dsn)
		}
	}
}
