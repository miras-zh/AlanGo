package app

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"alango/config"
	"alango/internal/cache"
	"alango/internal/database"
	"alango/internal/router"
	"alango/internal/worker"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type App struct {
	Config    *config.Config
	DB        *gorm.DB
	Redis     *redis.Client
	Server    *http.Server
	Scheduler *worker.Scheduler
}

func NewApp(cfg *config.Config) (*App, error) {
	db, err := database.Connect(cfg)
	if err != nil {
		return nil, err
	}

	if err := database.RunMigrations(cfg); err != nil {
		return nil, err
	}

	rdb, err := cache.Connect(cfg)
	if err != nil {
		return nil, err
	}

	r := router.NewRouter(db, rdb, cfg)

	server := &http.Server{
		Addr:              ":" + cfg.ServerPort,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return &App{
		Config:    cfg,
		DB:        db,
		Redis:     rdb,
		Server:    server,
		Scheduler: worker.NewScheduler(db),
	}, nil
}

func (a *App) Start(ctx context.Context) error {
	if a.Scheduler != nil {
		a.Scheduler.Start(ctx)
	}
	errCh := make(chan error, 1)
	go func() {
		log.Printf("[%s] API server starting on port %s", a.Config.SiteName, a.Config.ServerPort)
		if err := a.Server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		log.Println("Shutting down server...")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := a.Server.Shutdown(shutdownCtx); err != nil {
		return err
	}

	if sqlDB, err := a.DB.DB(); err == nil {
		_ = sqlDB.Close()
	}
	_ = a.Redis.Close()

	log.Println("Server stopped cleanly")
	return nil
}
