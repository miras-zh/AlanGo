package appversion

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
)

type VersionResponse struct {
	LatestVersion string `json:"latest_version"`
	LatestBuild   int    `json:"latest_build"`
	MinVersion    string `json:"min_version"`
	MinBuild      int    `json:"min_build"`
	UpdateURL     string `json:"update_url"`
	Title         string `json:"title"`
	Message       string `json:"message"`
}

func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		latestVersion := getEnv("APP_LATEST_VERSION", "1.0.0")
		latestBuild := getEnvInt("APP_LATEST_BUILD", 1)
		minVersion := getEnv("APP_MIN_VERSION", "1.0.0")
		minBuild := getEnvInt("APP_MIN_BUILD", 1)
		updateURL := getEnv("APP_UPDATE_URL", "https://apps.apple.com")
		title := getEnv("APP_UPDATE_TITLE", "Доступно обновление")
		message := getEnv("APP_UPDATE_MESSAGE", "Обновите приложение для доступа к новым функциям и улучшениям стабильности.")

		resp := VersionResponse{
			LatestVersion: latestVersion,
			LatestBuild:   latestBuild,
			MinVersion:    minVersion,
			MinBuild:      minBuild,
			UpdateURL:     updateURL,
			Title:         title,
			Message:       message,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
