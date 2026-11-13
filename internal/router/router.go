package router

import (
	"net/http"

	"alango/config"
	"alango/internal/analytics"
	"alango/internal/appversion"
	"alango/internal/audit"
	"alango/internal/auth"
	"alango/internal/item"
	"alango/internal/mail"
	"alango/internal/notification"
	"alango/internal/push"
	"alango/internal/realtime"
	"alango/internal/sport"
	"alango/internal/subscription"
	"alango/internal/telegram"
	"alango/internal/upload"
	"alango/internal/user"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func withCORS(next http.Handler, origin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func NewRouter(db *gorm.DB, rdb *redis.Client, cfg *config.Config) http.Handler {
	r := mux.NewRouter()

	r.HandleFunc("/healthz", healthzHandler).Methods("GET")
	r.HandleFunc("/readyz", readyzHandler(db, rdb)).Methods("GET")
	r.Handle("/metrics", withMetricsAuth(promhttp.Handler(), cfg.MetricsPassword)).Methods("GET")

	uploadService := upload.NewService(cfg.UploadDir, cfg.UploadPublicURL)
	r.PathPrefix("/uploads/").Handler(
		http.StripPrefix("/uploads/", http.FileServer(upload.NoListingFS{FileSystem: http.Dir(cfg.UploadDir)})),
	).Methods("GET")

	auditService := audit.NewService(db)
	hub := realtime.NewHub()
	realtimeHandler := realtime.NewHandler(hub, rdb, cfg.CORSAllowedOrigin)
	pushService := push.NewService(db, cfg.ExpoProjectID, cfg.FirebaseServiceAccountPath)
	notificationService := notification.NewService(db, hub, pushService)
	notificationHandler := notification.NewHandler(notificationService)

	mailSender := mail.NewSender(mail.SenderConfig{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		Username: cfg.SMTPUsername,
		Password: cfg.SMTPPassword,
		From:     cfg.SMTPFrom,
		Brand:    cfg.SiteName,
		SiteURL:  cfg.SiteURL,
	})

	googleVerifier := auth.NewGoogleVerifier(cfg.GoogleClientIDs)
	appleVerifier := auth.NewAppleVerifier(cfg.AppleBundleIDs)
	appleVerifier.ConfigureTokenAPI(cfg.AppleTeamID, cfg.AppleKeyID, cfg.ApplePrivateKey)

	userService := user.NewUserService(db)
	userHandler := user.NewUserHandler(
		userService,
		cfg.JWTSecret,
		rdb,
		uploadService,
		hub,
		auditService,
		mailSender,
		cfg.SiteURL,
		cfg.CookieSecure,
		googleVerifier,
		appleVerifier,
	)

	subscriptionService := subscription.NewService(db)
	subscriptionHandler := subscription.NewHandler(subscriptionService, auditService)

	analyticsService := analytics.NewService(db, rdb)
	analyticsHandler := analytics.NewHandler(analyticsService)

	itemService := item.NewService(db, rdb)
	itemHandler := item.NewHandler(itemService, uploadService, auditService, hub)

	sportService := sport.NewService(db)
	sportHandler := sport.NewHandler(sportService, uploadService)

	telegramBot := telegram.NewBotService()
	telegramHandler := telegram.NewHandler(telegramBot)

	// --- Public API endpoints ---
	r.Handle("/api/register", withPublicFormRateLimit("register", http.HandlerFunc(userHandler.Register), rdb)).Methods("POST")
	r.HandleFunc("/api/register/verify", userHandler.VerifyRegister).Methods("POST")
	r.Handle("/api/register/resend", withPublicFormRateLimit("register", http.HandlerFunc(userHandler.ResendRegisterCode), rdb)).Methods("POST")
	r.Handle("/api/login", withLoginRateLimit(http.HandlerFunc(userHandler.Login), rdb)).Methods("POST")
	r.Handle("/api/auth/google", withLoginRateLimit(http.HandlerFunc(userHandler.GoogleLogin), rdb)).Methods("POST")
	r.Handle("/api/auth/apple", withLoginRateLimit(http.HandlerFunc(userHandler.AppleLogin), rdb)).Methods("POST")
	r.Handle("/api/auth/refresh", withLoginRateLimit(http.HandlerFunc(userHandler.Refresh), rdb)).Methods("POST")
	r.Handle("/api/password-reset/request", withPasswordResetRateLimit(http.HandlerFunc(userHandler.RequestPasswordReset), rdb)).Methods("POST")
	r.Handle("/api/password-reset/confirm", withPasswordResetRateLimit(http.HandlerFunc(userHandler.ConfirmPasswordResetHandler), rdb)).Methods("POST")

	r.HandleFunc("/api/app/version", appversion.Handler()).Methods("GET")
	r.HandleFunc("/api/analytics/events", analyticsHandler.Track).Methods("POST")
	r.HandleFunc("/api/analytics/heartbeat", analyticsHandler.Heartbeat).Methods("POST")
	r.HandleFunc("/api/analytics/funnel", analyticsHandler.GetFunnel).Methods("GET")
	r.HandleFunc("/api/analytics/online", analyticsHandler.GetOnline).Methods("GET")
	r.HandleFunc("/api/analytics/traffic", analyticsHandler.GetTraffic).Methods("GET")

	r.HandleFunc("/api/realtime/ws", realtimeHandler.ServeWS).Methods("GET")

	// Public items listing & single item fetch
	r.HandleFunc("/api/items", itemHandler.List).Methods("GET")
	r.HandleFunc("/api/items/{id:[0-9]+}", itemHandler.GetByID).Methods("GET")

	// --- Public Sport Domain Endpoints (Arenas, Halls, Schedules, Bookings) ---
	r.HandleFunc("/api/arenas", sportHandler.ListArenas).Methods("GET")
	r.HandleFunc("/api/arenas/{id:[0-9]+}", sportHandler.GetArena).Methods("GET")
	r.HandleFunc("/api/arenas/{id:[0-9]+}/schedule", sportHandler.GetSchedule).Methods("GET")
	r.HandleFunc("/api/halls", sportHandler.ListHalls).Methods("GET")
	r.HandleFunc("/api/halls/{id:[0-9]+}", sportHandler.GetHall).Methods("GET")
	r.HandleFunc("/api/halls/{id:[0-9]+}/schedule", sportHandler.GetHallSchedule).Methods("GET")
	r.HandleFunc("/api/halls/{id:[0-9]+}/availability", sportHandler.HallAvailability).Methods("GET")
	optionalAuth := auth.OptionalAuthMiddleware(cfg.JWTSecret, cfg.JWTSecretPrevious, rdb, userService.IsActive)
	r.Handle("/api/bookings", optionalAuth(http.HandlerFunc(sportHandler.CreateBooking))).Methods("POST")
	r.Handle("/api/bookings", optionalAuth(http.HandlerFunc(sportHandler.ListBookings))).Methods("GET")
	r.HandleFunc("/api/business/telegram/notify", telegramHandler.NotifyBooking).Methods("POST")
	r.HandleFunc("/api/business/telegram/status", telegramHandler.GetStatus).Methods("GET")

	// --- Authenticated API endpoints ---
	authRouter := r.PathPrefix("/api").Subrouter()
	authRouter.Use(auth.AuthMiddleware(cfg.JWTSecret, cfg.JWTSecretPrevious, rdb, userService.IsActive))

	authRouter.HandleFunc("/logout", userHandler.Logout).Methods("POST")
	authRouter.HandleFunc("/auth/me", userHandler.GetMe).Methods("GET")
	authRouter.HandleFunc("/profile", userHandler.UpdateProfile).Methods("PATCH")
	authRouter.HandleFunc("/profile", userHandler.DeleteAccount).Methods("DELETE")
	authRouter.HandleFunc("/profile/avatar", userHandler.UploadAvatar).Methods("POST")
	authRouter.HandleFunc("/profile/push-token", userHandler.UpdatePushToken).Methods("PUT")
	authRouter.HandleFunc("/profile/business/disable", userHandler.DisableBusiness).Methods("POST")
	authRouter.HandleFunc("/profile/business/enable", userHandler.EnableBusiness).Methods("POST")
	authRouter.HandleFunc("/business/onboard", userHandler.OnboardBusiness).Methods("POST")
	authRouter.HandleFunc("/business/me", userHandler.GetBusiness).Methods("GET")
	authRouter.HandleFunc("/business/dashboard", sportHandler.GetBusinessDashboard).Methods("GET")
	authRouter.HandleFunc("/business/bookings", sportHandler.ListOwnBookings).Methods("GET")

	authRouter.HandleFunc("/realtime/ticket", realtimeHandler.MintTicket).Methods("POST")
	authRouter.HandleFunc("/notifications", notificationHandler.List).Methods("GET")
	authRouter.HandleFunc("/notifications/read", notificationHandler.MarkRead).Methods("POST")

	authRouter.HandleFunc("/subscription", subscriptionHandler.Get).Methods("GET")
	authRouter.HandleFunc("/subscription/request", subscriptionHandler.RequestChange).Methods("POST")
	authRouter.HandleFunc("/subscription/cancel-request", subscriptionHandler.CancelRequest).Methods("POST")
	authRouter.HandleFunc("/subscription/change", subscriptionHandler.Change).Methods("POST")

	// Admin API for future Admin Panel
	adminRouter := authRouter.PathPrefix("/admin").Subrouter()
	adminRouter.HandleFunc("/subscription-requests", subscriptionHandler.AdminListRequests).Methods("GET")
	adminRouter.HandleFunc("/subscription-requests/{id:[0-9]+}/approve", subscriptionHandler.AdminApproveRequest).Methods("POST")
	adminRouter.HandleFunc("/subscription-requests/{id:[0-9]+}/reject", subscriptionHandler.AdminRejectRequest).Methods("POST")

	// Authenticated items CRUD
	authRouter.HandleFunc("/items/me", itemHandler.ListMine).Methods("GET")
	authRouter.HandleFunc("/items", itemHandler.Create).Methods("POST")
	authRouter.HandleFunc("/items/{id:[0-9]+}", itemHandler.Update).Methods("PATCH")
	authRouter.HandleFunc("/items/{id:[0-9]+}/image", itemHandler.UploadImage).Methods("POST")
	authRouter.HandleFunc("/items/{id:[0-9]+}", itemHandler.Delete).Methods("DELETE")

	// Authenticated Sport Domain CRUD
	authRouter.HandleFunc("/arenas/{id:[0-9]+}", sportHandler.UpdateArena).Methods("PATCH")
	authRouter.HandleFunc("/arenas/{id:[0-9]+}/logo", sportHandler.UploadArenaLogo).Methods("POST")
	authRouter.HandleFunc("/arenas/{id:[0-9]+}/logo", sportHandler.DeleteArenaLogo).Methods("DELETE")
	authRouter.HandleFunc("/arenas/{id:[0-9]+}/schedule", sportHandler.SaveSchedule).Methods("PUT")
	authRouter.HandleFunc("/halls", sportHandler.CreateHall).Methods("POST")
	authRouter.HandleFunc("/halls/{id:[0-9]+}/photos", sportHandler.UploadHallPhoto).Methods("POST")
	authRouter.HandleFunc("/halls/{id:[0-9]+}/schedule", sportHandler.SaveHallSchedule).Methods("PUT")
	authRouter.HandleFunc("/halls/{id:[0-9]+}/photos", sportHandler.DeleteHallPhoto).Methods("DELETE")
	authRouter.HandleFunc("/bookings/{id:[0-9]+}/status", sportHandler.UpdateBookingStatus).Methods("PATCH")
	authRouter.HandleFunc("/bookings/{id:[0-9]+}/client-rating", sportHandler.RateBookingClient).Methods("PUT")
	authRouter.HandleFunc("/me/stats", sportHandler.GetMyStats).Methods("GET")

	return withSecurityHeaders(withCORS(withRateLimit(withMaxBodySize(r), rdb), cfg.CORSAllowedOrigin))
}
