# Архитектура и конфигурация проекта AlanGo

- **Директория проекта**: `/Users/miko/MyProduction/AlanGo`
- **Bundle ID**: `com.studio.alango`

## 1. Выбранные платформы (UI)
- **iOS (Expo 57 / React Native)**: ✅ Включено (`ui/mobile`, target: `ios`)
- **Android (Expo 57 / React Native)**: ✅ Включено (`ui/mobile`, target: `android`)
- **Web (Next.js 16 + Tailwind v4)**: ✅ Включено (`ui/web`, port: `3002`)
- **Design Tokens (`ui/design-tokens`)**: ✅ Включено

## 2. Продуктовые модули
- **Авторизация (JWT + Apple + Google + Password Reset)**: ✅
- **Push-уведомления (FCM + APNs + Expo) и In-App Notifications**: ✅
- **Realtime WebSocket (`/api/realtime/ws`)**: ✅
- **Подписки и тарифы (`standard` / `pro` / `vip`)**: ✅
- **Аналитика продуктовой воронки Case Operation**: ✅
- **Универсальный CRUD-модуль (`items`)**: ✅

## 3. Бэкенд, Инфраструктура и Сервисы
- **Go 1.25 API Server**: ✅ (:8092)
- **PostgreSQL 15**: ✅ (:5436)
- **Redis 7**: ✅ (:6380)
- **MinIO S3 (Объектное хранилище файлов)**: ➖ (локальная папка `./uploads`)
- **SMTP Почта + Mailpit**: ✅ (SMTP :1025 / Web UI :8025, `internal/mail/examples.go`)
- **Фоновые Cron-задачи (`internal/worker/scheduler.go`)**: ✅ (cleanup_expired_tokens, subscription_trial_check, retention_push_reminders, daily_funnel_snapshot)
- **Prometheus**: ➖
- **Grafana**: ➖
