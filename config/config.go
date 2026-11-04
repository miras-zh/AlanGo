package config

import (
	"errors"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

const minJWTSecretLen = 32

type Config struct {
	SiteName                   string
	SiteURL                    string
	DBHost                     string
	DBPort                     string
	DBUser                     string
	DBPassword                 string
	DBName                     string
	DBSSLMode                  string
	RedisAddr                  string
	RedisPassword              string
	RedisDB                    int
	ServerPort                 string
	JWTSecret                  string
	JWTSecretPrevious          string
	CORSAllowedOrigin          string
	UploadDir                  string
	UploadPublicURL            string
	ExpoProjectID              string
	FirebaseServiceAccountPath string
	SMTPHost                   string
	SMTPPort                   string
	SMTPUsername               string
	SMTPPassword               string
	SMTPFrom                   string
	MetricsPassword            string
	CookieSecure               bool
	GoogleClientIDs            string
	AppleBundleIDs             string
	AppleTeamID                string
	AppleKeyID                 string
	ApplePrivateKey            string
}

func NewConfig() (*Config, error) {
	_ = godotenv.Load()

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < minJWTSecretLen {
		return nil, errors.New("JWT_SECRET must be set and at least 32 characters long")
	}

	jwtSecretPrevious := os.Getenv("JWT_SECRET_PREVIOUS")
	if jwtSecretPrevious != "" && len(jwtSecretPrevious) < minJWTSecretLen {
		return nil, errors.New("JWT_SECRET_PREVIOUS must be at least 32 characters long when set")
	}

	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))
	serverPort := getEnv("SERVER_PORT", "8090")

	return &Config{
		SiteName:                   getEnv("SITE_NAME", "AlanGo"),
		SiteURL:                    getEnv("SITE_URL", "http://localhost:3000"),
		DBHost:                     getEnv("DB_HOST", "localhost"),
		DBPort:                     getEnv("DB_PORT", "5432"),
		DBUser:                     getEnv("DB_USER", "postgres"),
		DBPassword:                 getEnv("DB_PASSWORD", "postgres"),
		DBName:                     getEnv("DB_NAME", "alango"),
		DBSSLMode:                  getEnv("DB_SSLMODE", "disable"),
		RedisAddr:                  getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:              getEnv("REDIS_PASSWORD", ""),
		RedisDB:                    redisDB,
		ServerPort:                 serverPort,
		JWTSecret:                  jwtSecret,
		JWTSecretPrevious:          jwtSecretPrevious,
		CORSAllowedOrigin:          getEnv("CORS_ALLOWED_ORIGIN", "http://localhost:3000"),
		UploadDir:                  getEnv("UPLOAD_DIR", "./uploads"),
		UploadPublicURL:            getEnv("UPLOAD_PUBLIC_URL", "http://localhost:"+serverPort+"/uploads"),
		ExpoProjectID:              getEnv("EXPO_PROJECT_ID", ""),
		FirebaseServiceAccountPath: getEnv("FIREBASE_SERVICE_ACCOUNT_PATH", ""),
		SMTPHost:                   getEnv("SMTP_HOST", ""),
		SMTPPort:                   getEnv("SMTP_PORT", "587"),
		SMTPUsername:               getEnv("SMTP_USERNAME", ""),
		SMTPPassword:               getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:                   getEnv("SMTP_FROM", "no-reply@example.com"),
		MetricsPassword:            getEnv("METRICS_PASSWORD", "dev-metrics-password"),
		CookieSecure:               getEnv("COOKIE_SECURE", "false") == "true",
		GoogleClientIDs:            getEnv("GOOGLE_CLIENT_IDS", ""),
		AppleBundleIDs:             getEnv("APPLE_BUNDLE_IDS", "com.studio.alango"),
		AppleTeamID:                getEnv("APPLE_TEAM_ID", ""),
		AppleKeyID:                 getEnv("APPLE_KEY_ID", ""),
		ApplePrivateKey:            getEnv("APPLE_PRIVATE_KEY", ""),
	}, nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
