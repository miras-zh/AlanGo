# AlanGo — Full-Stack App Template

Продуктовый каркас (Go 1.25 + PostgreSQL 15 + Redis 7 + Expo 57 React Native + Next.js 16), выделенный из продакшн-архитектуры **Vison (`FotoLink`)** и интегрированный со стандартами воронки **Case Operation**.

---

## Что уже встроено из коробки

1. **Авторизация и безопасность (`internal/auth`, `internal/audit`)**
   - Email + Password (`bcrypt`), JWT Access Token + ротируемые Refresh Tokens (`refresh_tokens`), Redis Blacklist при logout.
   - Нативный **Sign in with Apple** (проверка JWKS ключей Apple + отзыв токенов при удалении аккаунта для соответствия требованиям App Store).
   - Нативный **Google Sign-In**.
   - Сброс пароля по Email (`password_reset_tokens`) и полное каскадное удаление аккаунта (`DELETE /api/users/me`).
   - Журнал аудита (`audit_logs`) для критичных событий безопасности.

2. **Push-уведомления и In-App уведомления (`internal/push`, `internal/notification`)**
   - Регистрация токенов устройств (`device_tokens` для `ios`, `android`, `web`).
   - Отправка через **Firebase Cloud Messaging (FCM HTTP v1)** с APNs high-priority заголовками + автоматический фоллбэк на **Expo Push API** (`ExponentPushToken[...]`) и логгер в dev-режиме.
   - Таблица `notifications` с пагинацией, счётчиком непрочитанных и `POST /api/notifications/read-all`.

3. **Realtime WebSocket (`internal/realtime`)**
   - Одноразовые тикеты (`POST /api/ws/ticket` → `GET /api/ws?ticket=...`), защищающие JWT от попадания в URL-логи.
   - Автоматический реконнект с экспоненциальным backoff на клиентах.

4. **Универсальная бизнес-сущность с полным CRUD (`internal/item`)**
   - Таблица `items` (`title`, `description`, `status`, `category`, `price`, `image_url`, `metadata JSONB`).
   - Готовые эндпоинты: публичный список с фильтрами/поиском (`GET /api/items`), мои записи (`GET /api/items/my`), создание (`POST /api/items`), обновление (`PATCH /api/items/{id}`), удаление (`DELETE /api/items/{id}`), загрузка изображения (`POST /api/items/{id}/image`).
   - Чтобы добавить новую доменную модель под конкретное приложение, достаточно скопировать пакет `internal/item` или переименовать его поля.

5. **Продуктовая воронка Case Operation (`internal/analytics`)**
   - Приём событий `POST /api/analytics/event` и сводка воронки `GET /api/analytics/funnel`:
     `app_install` → `first_launch` → `first_value` → `core_action` → `paywall_view` → `trial_start` → `subscribe`.
   - Heartbeat онлайн-присутствия в Redis (`POST /api/analytics/heartbeat`, `GET /api/analytics/online`).

6. **Подписки и тарифы (`internal/subscription`)**
   - Таблица `subscriptions` (`standard`, `pro`, `vip`), привязанная к пользователю.

7. **Мобильное приложение (`ui/mobile` — Expo 57 / React Native)**
   - Готовые экраны: Главная (`index.tsx`), CRUD записей (`items.tsx`), Уведомления (`notifications.tsx`), Профиль и тарифы (`profile.tsx`), Настройки (`settings/index.tsx`), Вход/Регистрация/Сброс пароля/Apple Name.
   - Поддержка светлой/тёмной темы (`ThemeProvider`), локализации RU/EN (`lib/i18n.tsx`), тактильного отклика (`lib/haptics.ts`) и баннера обновления версии (`AppUpdatePrompt`).

8. **Веб-приложение (`ui/web` — Next.js 16 + React 19 + Tailwind CSS v4)**
   - Лендинг с публичной лентой, Вход, Регистрация, Восстановление пароля, Панель управления CRUD (`/dashboard`), Профиль (`/profile`), а также обязательные для App Store страницы `/privacy` и `/terms`.

---

## Быстрый старт

```bash
# 1. Скопируйте .env (если проект создан через new-app.sh, .env уже создан автоматически)
cp .env.example .env

# 2. Запустите PostgreSQL + Redis + Backend + Web в Docker
make docker-up

# Или запустите только БД и Redis в Docker, а Go-бэкенд локально:
docker compose -f docker/docker-compose.yaml up -d db redis
make run
```

### Запуск мобильного приложения (Expo)
```bash
cd ui/mobile
npm install
npx expo start
```

### Запуск веб-приложения (Next.js)
```bash
cd ui/web
npm install
npm run dev
```
