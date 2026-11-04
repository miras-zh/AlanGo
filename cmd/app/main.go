package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"alango/config"
	"alango/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.NewConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	application, err := app.NewApp(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize app: %v", err)
	}

	if err := application.Start(ctx); err != nil {
		log.Fatalf("Server stopped with error: %v", err)
	}
}
