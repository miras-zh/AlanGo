# Changelog

Все важные изменения проекта **AlanGo** документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
версионирование следует [Семантическому версионированию (SemVer)](https://semver.org/lang/ru/).

---

## [1.0.0 (Build 2)] — 2026-11-05

### 🚀 Инфраструктура и серверный деплой (VPS)
- **Изолированный стек Docker на общем VPS (`78.140.223.90`)**:
  - Создан специализированный файл `docker/docker-compose.server.yaml` с изолированным пространством проекта `name: alango`.
  - Поднята база данных **PostgreSQL 15 Alpine** (`alango-db`) в изолированной сети `alango_internal` с персистентным томом `alango_pgdata`.
  - Поднят **Redis 7 Alpine** (`alango-redis`) для управления сессиями, кэширования и защиты от брутфорса.
  - Собран и запущен Go-сервер **API** (`alango-api`) на порту `8092`.
- **Caddy Reverse Proxy & Бесплатный SSL (Let's Encrypt)**:
  - Настроен виртуальный хост `alango.78.140.223.90.sslip.io` без необходимости покупки отдельного домена.
  - Автоматически выпущен доверенный SSL-сертификат от **Let's Encrypt** (HTTPS / HTTP/2).
  - Настроено безопасное внутреннее проксирование трафика в Docker-сеть к `alango-api:8092`.
  - Полная изоляция от существующего проекта Vison (`vison.kz`) — работа соседних контейнеров не затронута.

### 🗄️ База данных и бэкенд
- **Миграции схемы БД**:
  - `000001_init_schema`: пользователи, аутентификация (JWT, Apple, Google), журнал аудита, уведомления, аналитика воронки.
  - `000002_sport_domain`: таблицы спортивного домена (`arenas`, `halls`, `arena_schedules`, `bookings`).
  - Добавлены сидовые данные (Astana Arena Sport, Nomad Pro Complex, Daulet Club, Barys Arena).
- **Спортивный домен (`internal/sport`)**:
  - Реализованы модели, сервис и HTTP-обработчики для арен, залов, расписаний и бронирований.
  - Подключены публичные и защищенные маршруты в `internal/router/router.go`.
- **Исправления конфигурации**:
  - Синхронизированы учетные данные `POSTGRES_USER` и `POSTGRES_PASSWORD` между базой данных и приложением в Docker Compose.
  - В `.env` и `.env.example` обновлен `APPLE_BUNDLE_IDS=kz.alango.app`.

### 📱 Мобильное приложение (iOS / Expo 57)
- **Подключение к боевому бэкенду**:
  - Создан `ui/mobile/.env` с боевым адресом API: `EXPO_PUBLIC_API_URL=https://alango.78.140.223.90.sslip.io`.
- **Версионирование**:
  - Номер сборки поднят до `buildNumber: 2` в `app.json`, `Info.plist` (`CFBundleVersion`) и `AlanGo.xcodeproj` (`CURRENT_PROJECT_VERSION`).
- **Сетевая безопасность (App Transport Security)**:
  - Включен `NSAllowsArbitraryLoads: true` для бесперебойной работы с тестовыми серверами.

---

## [1.0.0 (Build 1)] — 2026-11-04

### 🍏 Регистрация в Apple Developer & App Store Connect
- **Регистрация App ID**:
  - Зарегистрирован постоянный Bundle Identifier: **`kz.alango.app`** в Apple Developer Console.
  - Включены обязательные возможности (Capabilities): **Sign In with Apple**, **Push Notifications**.
- **Синхронизация проекта с Bundle ID**:
  - `ui/mobile/app.json`: `bundleIdentifier` и `package` установлены в `kz.alango.app`.
  - `ui/mobile/ios/AlanGo/Info.plist`: схема URL обновлена на `kz.alango.app`.
  - `ui/mobile/ios/AlanGo.xcodeproj/project.pbxproj`: `PRODUCT_BUNDLE_IDENTIFIER` синхронизирован на `kz.alango.app`.
- **App Store Connect**:
  - Создана карточка приложения `Alan Go` (платформа iOS, язык English (U.S.), SKU `alango-ios`).
  - Добавлена настройка `ITSAppUsesNonExemptEncryption: false` для автоматического прохождения проверки на экспортное шифрование.
- **TestFlight**:
  - Успешно собран первый архив (`1.0.0 (1)`) в Xcode и загружен в Apple.
  - Настроена внутренняя группа тестирования (`Star`), протестирована доставка приглашения и появление приложения в TestFlight на реальном iPhone.
