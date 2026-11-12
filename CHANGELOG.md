# Changelog

Все важные изменения проекта **AlanGo** документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
версионирование следует [Семантическому версионированию (SemVer)](https://semver.org/lang/ru/).

---

## [Unreleased]

### 💼 Бизнес-аккаунт: самостоятельное открытие, отключение и включение (по образцу Vison)
- **Задача**: клиент сам открывает бизнес-аккаунт через мастер (тип объекта → название → виды спорта → город → подтверждение), попадает в бизнес-кабинет, может отключить бизнес и включить его обратно без потери данных.
- **Миграция `000004_business_onboarding`**: в `arenas` добавлены `venue_type` (`complex` | `single` | `outdoor`) и `hidden` (арена скрыта из каталога), индекс `idx_arenas_hidden`.
- **Бэкенд ([`internal/user/business.go`](file:///Users/miko/MyProduction/AlanGo/internal/user/business.go))**:
  - `POST /api/business/onboard`: создаёт арену владельца (`owner_id`). Для «Отдельного зала» и «Открытой площадки» сразу создаётся один зал. Роль меняется на `business`, ответ — новая пара токенов, `user_info` и `arena`. Валидация формата, названия (до 120 байт), видов спорта (дубликаты убираются, максимум 12) и города. Повторный onboard → 409.
  - `GET /api/business/me`: роль, `business_role` и своя арена.
  - `POST /api/profile/business/disable`: роль → `client`, арена `hidden = true`, данные сохраняются.
  - `POST /api/profile/business/enable`: роль → `business`, арена снова видна, без повторного онбординга.
  - При смене роли старый access-токен отзывается (blacklist), выдаётся новый. Действия пишутся в аудит (`role_change`).
  - Публичные `/api/arenas` и `/api/halls` больше не отдают скрытые арены и их залы.
- **Мобильное приложение**:
  - [`lib/business.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/business.ts): API и справочники (типы объектов, виды спорта).
  - [`components/BusinessAccountCard.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/BusinessAccountCard.tsx): карточка в профиле с тремя состояниями — «Создать бизнес-аккаунт», «Активен» (открыть кабинет / отключить с подтверждением), «Отключён» (включить). Добавлена и в профиль бизнес-кабинета.
  - [`app/business-onboarding.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business-onboarding.tsx): мастер из 5 шагов с прогресс-баром, экраном «Поздравляем!» и автопереходом в бизнес-кабинет.
  - `lib/registration.ts`: общий `persistAuthResponse` (вход через Apple/Google и смена бизнес-режима).
- **🐛 Исправлено: бизнес-кабинет показывал чужую арену.** `app/business/index.tsx` подставлял арену #1 («Astana Arena Sport»), если `arenaId` не задан. Теперь своя арена берётся с сервера (`/api/business/me`).
- **Тестовые переключатели аккаунтов** (`dev.arena1`, `dev.client`, гость) в бизнес-кабинете показываются только в dev-сборках (`__DEV__`), в TestFlight/App Store их нет.
- **Проверка**: на временных Postgres и Redis (Docker) прогнан полный сценарий API: onboard → старый токен 401 → повторный onboard 409 → `/business/me` → арена в каталоге → disable (арена и зал скрыты) → повторный disable 400 → enable. `go build`, `go test ./internal/...` и `tsc` проходят. В симуляторе пройдены все 5 шагов мастера. Подтверждение на боевом сервере вернуло `404`, потому что бэкенд ещё не задеплоен.
- **Осталось**: деплой бэкенда (миграция 000004 применится автоматически при старте). Разделы кабинета (залы, график, брони) пока на тестовых данных — перевести их на реальное API.

### 🧾 Инцидент: `RequestUnknownException` при входе через Apple (симулятор, 2026-11-12)
- **Симптом**: под кнопкой «Вход с Apple» красный текст `RequestUnknownException: The authorization attempt failed for an unknown reason (ExpoAppleAuthentication/AppleAuthenticationExceptions.swift:61)`.
- **Причина**: это системная ошибка iOS `ASAuthorizationError.unknown` (1000), а не баг приложения. Apple ID в симуляторе потребовал повторной проверки пароля («Проверка Аккаунта Apple»), а диалог закрыли кнопкой «Не сейчас». iOS прервал авторизацию с кодом `unknown`.
- **Решение**: ввести пароль Apple ID в «Настройках» симулятора и повторить вход.
- **Недочёт UX (не исправлен)**: пользователю показывается сырой английский текст исключения вместо понятного сообщения на русском.
- **Итог (18:21)**: вход через Apple в симуляторе прошёл. Пароль запрашивается при каждом входе, потому что в «Настройках» симулятора указано «Доверенные устройства недоступны»: симулятор не считается доверенным устройством Apple ID, и Apple каждый раз перепроверяет пароль. На реальном iPhone так не происходит.
- **Аватар проверен пользователем**: буква «M» по умолчанию, карандаш, выбор фото, круговая обрезка, сохранение. Фото загрузилось на сервер и сразу отобразилось в профиле.
- **Продолжение**: при повторном вводе пароля Apple ID iOS показал системное окно «Сбой подключения». Проверено: с Mac серверы Apple (`idmsa.apple.com`, `appleid.apple.com`) и API AlanGo доступны, VPN (VPN Proxy Master, VPNSuper) отключены, маршрут через `en0`. Значит, сбой внутри службы Apple ID симулятора (`akd`), к приложению он не относится. Рекомендация: перезагрузить симулятор (Device → Restart) или выйти и снова войти в Apple ID в «Настройках» симулятора. Для проверки остальных функций (аватар и т. п.) можно войти по email.

### 🖼️ Аватар профиля: загрузка, обрезка, буква по умолчанию
- **Аватар по умолчанию ([`app/(tabs)/profile.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/profile.tsx))**: убрана чужая заглушка с Unsplash. Без фото показывается первая буква имени на `colors.surfaceElevated` с обводкой `colors.primary`.
- **Значок-карандаш** в углу аватара: нажатие на него или на аватар открывает галерею. Во время загрузки поверх аватара крутится индикатор.
- **[`lib/pickImage.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/pickImage.ts)** (из Vison): выбор фото, уменьшение до 2048px и перекодировка в JPEG (HEIC с iPhone сервер не принимает).
- **[`components/AvatarCropModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/AvatarCropModal.tsx)** (из Vison, на токенах AlanGo): круговая обрезка с перемещением и масштабом, результат — JPEG 640×640. Загружается через существующий `POST /api/profile/avatar`, новый URL сразу пишется в сессию (`photo` / `avatar_url`).
- **Зависимость**: `expo-image-manipulator ~57.0.22` (нативный модуль, потребовались `pod install` и пересборка iOS).
- **🐛 Исправлено: первый реальный пользователь разлогинивался при каждом запуске.** `hydrateSession` в [`lib/auth.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/auth.ts) удалял сессию с `id === "1"` как «мок». Теперь мок-сессии определяются по токену `mock_jwt_token…` и email `@sportrent.kz`.

### 🍏 Вход через Apple и Google (нативная сборка)
- **Причина ошибок `signInAsync is not available` / `RNCWebViewModule could not be found`**: приложение запускалось в Expo Go и из устаревшего бинарника `com.studio.alango` (build 1, без `react-native-webview`). Старая сборка удалена из симулятора, установлен свежий Debug-бинарник `kz.alango.app`; нативные модули Apple / Google / WebView подтверждены.
- **Общий компонент [`SocialAuthButtons`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/SocialAuthButtons.tsx)** на экранах входа и регистрации вместо дублированного Apple-кода. Каждая кнопка показывается только при наличии нативного модуля и конфига, редирект в `/business` или `/(tabs)` по роли.
- **[`lib/appleAuth.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/appleAuth.ts)**: хук `useAppleSignIn` по образцу Vison; ответ 422 (новый аккаунт без имени) ведёт на `apple-name`, где вход повторяется с введённым именем (`full_name`).
- **[`lib/googleAuth.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/googleAuth.ts)**: нативный `@react-native-google-signin/google-signin` с ленивой загрузкой модуля; `loginWithGoogle` → `POST /api/auth/google`. Кнопка скрыта, пока не заданы `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- **`lib/registration.ts`**: общий `persistSocialAuth` для сохранения сессии Apple/Google.
- Удалён неиспользуемый `components/AppleSignInButton.tsx` (отправлял неверное поле `name` вместо `full_name`).

### 🔙 Надежная навигация назад на экранах авторизации и регистрации
- **Гарантированный возврат на главный экран ([`ui/mobile/app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx), [`ui/mobile/app/register.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/register.tsx))**:
  - Реализован умный обработчик `handleBack`: если стек навигации пуст (`router.canGoBack() === false`), кнопка возврата гарантированно перенаправляет пользователя на главный экран `router.replace("/(tabs)")`;
  - Увеличена сенсорная зона нажатия кнопки с помощью `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}`;
  - Добавлен приятный тактильный отклик `hapticSelection()` при нажатии.

### 🧹 Полное удаление моковых пользователей и дефолтных сессий («Мико Аскаров»)
- **Очистка состояния сессии в [`ui/mobile/lib/auth.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/auth.ts)**:
  - Полностью удалена константа `MOCK_USER` («Мико Аскаров», `miko@sportrent.kz`) и дефолтный моковый токен `"mock_jwt_token_sportrent"`;
  - Начальные значения сессии зафиксированы строго как `cachedUser = null` и `cachedToken = null`;
  - В `hydrateSession()` добавлена автоматическая очистка устаревших сохранённых тестовых сессий (`miko@sportrent.kz` / `dev.arena`), возвращая `null` для чистого гостевого состояния;
  - Метод `getSessionUser()` возвращает `null`, если пользователь не авторизован через форму входа или Apple ID.
- **Редизайн экрана «Мой профиль» ([`ui/mobile/app/(tabs)/profile.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/profile.tsx))**:
  - Полностью удален блок быстрого переключения тестовых аккаунтов (`dev.arena1`, `dev.arena2`, «Войти как гость», «Экран входа / Авторизация» с паролями `12345`);
  - **Гостевое состояние (`!user`)**: при входе неавторизованного пользователя отображается аккуратная карточка с предложением войти/зарегистрироваться по кнопке «Войти / Зарегистрироваться», которая направляет на [`ui/mobile/app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx);
  - **Авторизованное состояние (`user`)**: отображаются исключительно реальные данные вошедшего пользователя (настоящее имя, email, телефон, город, статус тарифа, форма редактирования и кнопка выхода из аккаунта).

### ⚽ Интро-анимация на входе и темный фон экрана запуска (Dark Splash)
- **Устранение белого экрана на старте приложения**:
  - В нативном файле [`ui/mobile/ios/AlanGo/SplashScreen.storyboard`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/ios/AlanGo/SplashScreen.storyboard) белый системный фон `systemBackgroundColor` заменен на фирменный глубокий темный цвет `colors.background` (`#080D0B`);
  - В конфигурации [`ui/mobile/app.json`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app.json) цвет фона зафиксирован как `#080D0B` в параметрах `splash.backgroundColor` и `android.adaptiveIcon.backgroundColor`;
  - В [`ui/mobile/theme/ThemeProvider.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/theme/ThemeProvider.tsx) режим по умолчанию переведен на принудительный `dark`, исключая светлую вспышку при светлой системной теме устройства.
- **Интерактивная интро-анимация с пульсацией и пролетающим мячом ([`ui/mobile/components/AnimatedSplashScreen.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/AnimatedSplashScreen.tsx))**:
  - Реализован кастомный оверлей на нативном `Animated` (60/120 FPS с аппаратным ускорением);
  - **Пульсирующая буква «А» / Логотип**: иконка плавно появляется с масштабированием и выполняет неоновое изумрудное дыхание/пульс с эффектом свечения;
  - **Пролетающий 3D-мяч**: яркий неоновый спортивный мяч с текстурой и шлейфом скорости стремительно пролетает по кинематографичной дуге через экран с динамическим вращением, зумом и синхронизированным тактильным виброоткликом (`hapticImpact`);
  - **Бесшовный переход**: скрытие нативного экрана через `SplashScreen.hideAsync()` и мягкий фейдаут оверлея в готовый интерфейс;
  - Компонент подключен в корень приложения [`ui/mobile/app/_layout.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/_layout.tsx).

### 🏠 Полный редизайн Главного экрана (`ui/mobile/app/(tabs)/index.tsx`)
- **Строгое соблюдение дизайн-системы ([`DESIGN_SYSTEM.md`](file:///Users/miko/MyProduction/AlanGo/DESIGN_SYSTEM.md))**:
  - Полный отказ от разрозненных HEX-цветов в пользу семантических токенов `colors.background`, `colors.surface`, `colors.surfaceElevated`, `colors.primary`, `colors.accent`, `colors.border`, `colors.glassBorder`;
  - Переход на 4px-сетку (`spacing`: 16px боковые поля, 20px секции, 12px между карточками, 110px нижний скролл);
  - Стандартизация скруглений (`radii`: чипы 12px, кнопки 14px, карточки 18px, модалки 24px);
- **Сквиркл-чипы видов спорта**:
  - Категории «Все», «Футбол», «Теннис», «Баскетбол», «Падл», «Волейбол» в едином премиальном темном стиле с мягким зеленым свечением и тонкой рамкой при выборе;
- **Интеграция унифицированных карточек площадок [`VenueCard`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/VenueCard.tsx)**:
  - Секция «Популярные залы» переведена на стандарт `VenueCard` с превью, бейджами, характеристиками, рейтингом и ценой;
  - Добавлена сквозная синхронизация избранного через `AsyncStorage` (`alango_user_favorites`);
- **Полишинг баннеров и модального окна быстрого бронирования**:
  - Обновлены промо-блоки «Абонементы и Пакеты игр» и «Залы рядом на карте» с живой пульсирующей точкой;
  - Модальное окно быстрого бронирования приведено к стандарту (скругление 24px, стеклянные чипы слотов 12px, акцентная кнопка 14px).

### 🍏 Реальная авторизация и регистрация через Apple ID (`kz.alango.app`)
- **Полная очистка экранов входа и регистрации от тестовых моков**:
  - В [`ui/mobile/app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx) полностью удален блок быстрых тестовых входов (`dev.arena1`, `dev.arena2`, `dev.client`, `guest`), удалены кнопки «Войти как гость» и разделитель «ИЛИ ВХОД ВРУЧНУЮ»;
  - Вход по email/паролю и через Apple ID переведены на 100% боевую валидацию и работу с реальной базой данных через Go API;
  - В [`ui/mobile/app/register.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/register.tsx) очищены плейсхолдеры, валидация пароля приведена в соответствие со строгими правилами бэкенда (минимум 8 символов, буквы и цифры);
  - В [`ui/mobile/lib/registration.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/registration.ts) удалены все dev-перехваты `startRegistration`, `verifyRegistration` и `loginWithEmail`.
  - В [`ui/mobile/lib/registration.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/registration.ts), [`ui/mobile/app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx) и [`ui/mobile/app/register.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/register.tsx) полностью удалены любые тестовые мок-аккаунты (`apple.user@sportrent.kz` и симуляции);
  - Авторизация и регистрация через Apple вызывают нативный метод `AppleAuthentication.signInAsync` и передают реальный криптографический `identity_token` Apple на серверный эндпоинт `POST /api/auth/apple`;
  - На бэкенде Go токен проверяется публичными криптографическими RSA-ключами Apple (`https://appleid.apple.com/auth/keys`) по Bundle ID `kz.alango.app`, после чего пользователь создается/авторизуется в PostgreSQL с сохранением сессии;
  - Подключены боевые параметры в `.env`: `APPLE_TEAM_ID=4CKDU7Z38L`, `APPLE_KEY_ID=3LG77H4T6M` и закрытый ключ `AuthKey_3LG77H4T6M.p8` из папки `ui/mobile/key/` для токен-сервиса и отзыва сессий.

### 🏆 Редизайн экрана «События» и нативный Apple Liquid Glass
- **Архитектура нативного стекла ([`ui/mobile/components/GlassSurface.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/GlassSurface.tsx))**:
  - Реализован переиспользуемый компонент `GlassSurface` на базе `BlurView` (`systemChromeMaterialDark`) с поддержкой тонкого стеклянного канта `rgba(255, 255, 255, 0.12)`, полупрозрачного затемнения и производительного фолбэка для Android и Web;
  - Поддержка активного состояния с зеленым свечением (`rgba(0, 201, 104, 0.18)`), зеленым кантом `colors.primary` и мягким размытием.
- **Компактные горизонтальные карточки событий ([`ui/mobile/components/EventCard.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/EventCard.tsx))**:
  - Новая компоновка строго по референсу: превью ~34% ширины со стеклянным бейджем вида спорта («Сквош и падл», «Футбол», «Теннис», «Баскетбол»), справа — заголовок, дата со временем, локация, цена и акцентная зеленая кнопка «Записаться»;
  - Поддержка добавления события в избранное (сердечко в правом верхнем углу).
- **Стеклянные кнопки категорий спорта ([`ui/mobile/app/(tabs)/events.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/events.tsx))**:
  - 6 сквиркл-кнопок: «Все» (с фирменной сеткой из 4 точек), «Футбол», «Теннис», «Баскетбол», «Падл», «Другое»;
  - Активная категория сохраняет эффект стекла с изумрудным свечением и кантом `#00C968`;
  - Интерактивная мгновенная фильтрация событий.
- **Модальные окна фильтрации и календаря**:
  - [`ui/mobile/components/EventsFilterModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/EventsFilterModal.tsx): выдвижная стеклянная шторка с фильтрацией по формату (Турнир / Открытая игра / Мастер-класс), диапазону цен и наличию мест;
  - [`ui/mobile/components/EventCalendarModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/EventCalendarModal.tsx): быстрый выбор дат («Все даты», «Сегодня», «В эти выходные», «На этой неделе»);
  - Индикатор активности (красная точка `#F04452`) на кнопке фильтров в шапке.
- **Экран полного списка «Все события» ([`ui/mobile/app/events/all.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/events/all.tsx))**:
  - Полноэкранный каталог с вертикальным скроллом, поиском по названию и локации, фильтрацией и сохранением выбранных параметров.
- **Обновление плавающего таб-бара ([`ui/mobile/components/LiquidGlassTabBar.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/LiquidGlassTabBar.tsx))**:
  - Активный таб «События» синхронизирован с макетом (изумрудное свечение капсулы, иконка кубка в `#00C968`, подпись в `colors.primary`).

### 🍎 Полноценная нативная авторизация и регистрация через Apple ID (Production Ready)
- **Полное устранение симуляций и моков в мобильном приложении**:
  - В [`ui/mobile/lib/registration.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/registration.ts), [`ui/mobile/app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx) и [`ui/mobile/app/register.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/register.tsx) полностью удалены любые моковые токены (`expo_go_mock_apple_token`) и фейковые пользователи («Мико Аскаров»);
  - Нативная функция `loginWithApple()` передает строго реальный криптографический `identity_token` Apple на бэкенд `POST /api/auth/apple`;
  - Сохраняется реальная серверная сессия с валидными JWT, refresh-токеном и записью пользователя из базы данных PostgreSQL;
  - Обеспечена корректная обработка отмены авторизации (`ERR_REQUEST_CANCELED`) и вывод реальных системных ошибок.
- **Устойчивость создания профиля на бэкенде Go ([`internal/user/service.go`](file:///Users/miko/MyProduction/AlanGo/internal/user/service.go))**:
  - В методе `FindOrCreateByApple` добавлен автоматический безопасный фолбэк для имени пользователя: если при регистрации Apple не предоставил имя (или пользователь его скрыл), имя генерируется из локальной части email или назначается «Пользователь Apple», исключая ошибку `ErrAppleNameRequired`.
- **Локальная сборка серверного бинарника**:
  - Скомпилирован актуальный бинарник бэкенда под Linux amd64 (`bin/server`).

### 🏟️ Редизайн экрана «Залы» по макету (Компактные горизонтальные карточки)
- **Новая архитектура карточки зала ([`ui/mobile/components/VenueCard.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/VenueCard.tsx))**:
  - Полный переход от вертикальной карточки с тяжелым фото к ультра-компактной горизонтальной компоновке по макету;
  - Слева: квадратное фото-превью `108 × 108 px` (`borderRadius: 14`) с фолбэком-заглушкой и компактной кнопкой «В избранное» в верхнем углу;
  - Справа: информационный блок со строгой иерархией:
    1. Название зала (до 2 строк, гибкая высота);
    2. Рейтинг `★ 4.8` и количество отзывов в скобках;
    3. Адрес и расстояние (`пр. Туран 57 · 1.8 км`);
    4. Краткие характеристики площадки (`Футбол · 5×5 · Душ` / `Баскетбол · Паркет`);
    5. Ближайшее свободное время (при наличии слотов);
    6. Нижний ряд: акцентная цена `от 14 000 ₸ / час` и круглая кнопка перехода `→` (`colors.primary`).
- **Синхронизация контролов экрана ([`ui/mobile/app/(tabs)/items.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/items.tsx))**:
  - В шапку добавлена прямая навигация на интерактивную карту (`/map`) по кнопке локации;
  - В строке контролов зафиксированы плашки «Сортировка ⌵» и выбор города «↗ Астана ⌵»;
  - Подготовлен сбор характеристик зала из реальных данных (`capacity`, `surfaceType`, `sportType`, удобства);
  - Сохранен отступ `paddingBottom: 110` под плавающий таб-бар с системным размытием Liquid Glass.

### 🛡️ Заявочная система обновления тарифов подписки (Admin Approval API)
- **Бэкенд Go API ([`internal/subscription/`](file:///Users/miko/MyProduction/AlanGo/internal/subscription/))**:
  - Создана модель `SubscriptionRequest` и миграции (`000003_subscription_requests.up.sql`);
  - Реализован клиентский эндпоинт `POST /api/subscription/request` для отправки заявки на смену тарифа со статусом `pending`;
  - Расширен `GET /api/subscription` для возврата актуальной заявки на рассмотрении (`pending_request`);
  - Реализованы административные API-эндпоинты для будущей веб-панели управления:
    - `GET /api/admin/subscription-requests` (список заявок с фильтром по статусу);
    - `POST /api/admin/subscription-requests/{id}/approve` (одобрение заявки и авто-активация тарифа);
    - `POST /api/admin/subscription-requests/{id}/reject` (отклонение заявки с комментарием);
- **Клиентский UX в мобильном приложении ([`ui/mobile/app/(tabs)/profile.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/profile.tsx), [`ui/mobile/lib/user.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/user.ts))**:
  - Устранена мгновенная смена тарифа; теперь при выборе нового плана отправляется заявка администратору с диалогом: *«Заявка отправлена 🎉. Ожидайте подтверждения от администратора»*;
  - Добавлено постоянное сохранение и синхронизация статуса заявки в локальном хранилище `AsyncStorage` (`alango_pending_subscription_request`), исключая сброс статуса после закрытия модалки или перезапуска приложения;
  - На карточке тарифа (например, «VIP Безлимит») добавлен заметный статус-бейдж `⏳ На рассмотрении`, янтарная окантовка `#F59E0B` и блокировка повторной отправки дублирующей заявки при нажатии;
  - В баннере ожидания добавлена кнопка «Отозвать» для отмены заявки пользователем;
  - Реализован эндпоинт `POST /api/subscription/cancel-request` на бэкенде Go;
  - Доработана функция `fetchMySubscription()` с интеллектуальным слиянием серверного и локального состояния.
  - В профиле отображается статус-баннер: *«Заявка на тариф {ТАРИФ}: Ожидает подтверждения от администратора»*;
- **Локальная сборка бинарника**:
  - Скомпилирован бинарник для серверов Linux amd64 (`bin/server`).

### 💳 Управление бронями: Редактирование записей и учет частичной/полной оплаты
- **Система учета оплаты и предоплаты ([`ui/mobile/lib/sportRentData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/sportRentData.ts))**:
  - В модель `Booking` добавлены поля `paidAmount` (внесенная сумма) и `paymentStatus` (`paid` / `partial` / `not_paid`);
  - Реализованы сервисные функции `updateBookingPayment` (обновление оплаты с автоматическим расчетом статуса) и `updateBookingDetails` (полное сохранение измененных параметров брони);
- **Интерактивные бейджи оплаты на карточках броней ([`ui/mobile/app/business/bookings.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/bookings.tsx))**:
  - Цветовая индикация: 🟢 «Оплачено 100%», 🟠 «Предоплата: X ₸ (Остаток: Y ₸)», ⚪️ «Не оплачено»;
  - Клик по бейджу открывает быстрое управление оплатой;
- **Модальное окно быстрого изменения оплаты ([`ui/mobile/components/PaymentModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/PaymentModal.tsx))**:
  - Сводка (Общая сумма, Внесено, Остаток к доплате);
  - Быстрые пресеты: «100% (Вся сумма)», «50%», «Предоплата 2 000 ₸», «Сброс (0 ₸)» и поле произвольной суммы;
- **Модальное окно полного редактирования брони ([`ui/mobile/components/EditBookingModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/EditBookingModal.tsx))**:
  - Редактирование клиента (имя, телефон), зала, даты, временного слота, цены, оплаты, заметок и статуса;
  - Открытие по кнопке «Изменить» на карточке и по клику на слот в `BookingsCalendar`;
- **Фиксация оплаты при ручной записи ([`ui/mobile/components/ManualBookingModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/ManualBookingModal.tsx))**:
  - Добавлен блок фиксации внесенной суммы (предоплата / 100% оплата) сразу при бронировании администратором.

### 🗺️ Исправление тайлов карты «Залы рядом» (Устранение водяного знака CARTO)
- **Замена провайдера картографических тайлов и скрытие атрибуции ([`ui/mobile/app/map.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/map.tsx))**:
  - Устаревший платный слой CARTO Voyager заменен на официальный бесплатный слой **OpenStreetMap** (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`);
  - Полностью ликвидирован водяной знак *«API KEY REQUIRED carto.com/basemaps/apikey»*;
  - Тайлы загружаются без API-ключей с полной детализацией городов Казахстана на русском и казахском языках;
  - Скрыта системная плашка Leaflet и атрибуции (`attributionControl: false` и `.leaflet-control-attribution { display: none !important; }`) в правом нижнем углу экрана.

### 🗺️ Интерактивная карта «Залы рядом» для игроков
- **Новый экран интерактивной карты ([`ui/mobile/app/map.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/map.tsx))**:
  - Интеграция легковесной карты на базе Leaflet и CartoDB Voyager;
  - Кластеризация меток: синие круглые бейджи со счетчиками объектов (`2`, `3`, `5`, `9`, `12`...);
  - Ценовые бабблы спортивных площадок с ценой за час (например, `от 8 000 ₸`);
  - Кнопки зума `+` / `-` слева сверху и кнопка определения геопозиции пользователя («Прицел») справа сверху;
  - Мульти-фильтр по видам спорта в шапке карты (Футбол, Баскетбол, Теннис, Волейбол, Падел);
  - Плавающая шторка площадки (Preview Card) при нажатии на метку с переходом к бронированию `arena/[id]`;
- **Точки входа на главном экране ([`ui/mobile/app/(tabs)/index.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/index.tsx))**:
  - Кнопка карты `map-outline` в строке поиска;
  - Виджет-баннер «Залы рядом на карте» с пульсирующим индикатором в верхней секции;
- **Координатная привязка объектов ([`ui/mobile/lib/sportRentData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/sportRentData.ts))**:
  - Добавлены точные географические координаты (`latitude`, `longitude`) для арен Алматы, Астаны и Шымкента.

### 🛠️ Исправление регистрации и авторизации через Apple ID в Expo Go и Dev-режиме
- **Ликвидация блокирующего алерта при регистрации через Apple**:
  - В [`ui/mobile/app/register.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/register.tsx) и [`ui/mobile/app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx) устранен блокирующий Alert (*«Вход через Apple работает в нативной сборке приложения...»*);
  - Реализован умный бесшовный переход: в среде Expo Go / симуляторе регистрация и вход выполняются автоматически с созданием локальной сессии тестового Apple ID без прерывания пользовательского пути;
  - В нативных релизных сборках (TestFlight / App Store) полностью сохранена официальная нативная биометрия и проверка через Apple API;
- **Надежность регистрации по Email**:
  - В [`ui/mobile/lib/registration.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/registration.ts) добавлен dev-фоллбэк для подтверждения кода (мастер-коды `1111` / `0000`), защищающий от сбоев доставки писем при тестировании.

### 📝 Фиксация заметок, идей и нового функционала карты
- **Создание проектного бэклога ([`docs/BACKLOG.md`](file:///Users/miko/MyProduction/AlanGo/docs/BACKLOG.md))**:
  - Зафиксированы и категоризированы 8 продуктовых и технических пунктов (календарь «месяц–неделя», реорганизация баннера и галереи в карточке, детализация характеристик полей, матрица расписания по полям и слотам, аудит «Моих броней», восстановление выбора фото в бизнесе, реактивное обновление тарифа, устранение редиректов на главном экране бизнеса);
  - **Новая задача P0**: Проектирование и интеграция экрана «Залы рядом» (интерактивная карта со спортивными комплексами, кластеризацией, ценовыми бейджами и геолокацией).

## [1.6.0] — 2026-11-06

### 🎨 Восстановление оригинальной 3D-иконки приложения (Сборка 1) и инкремент до Build 4
- **Возврат оригинальной иконки (Сборка 1)**:
  - Восстановлена оригинальная 3D-иконка (объемная неоновая буква «A», газон стадиона, софиты и теннисный мяч);
  - Прозрачный альфа-канал на углах устранен (`hasAlpha: no`) для строгого соответствия требованиям App Store;
  - Обновлены все ассеты приложения: `ui/mobile/assets/icon.png`, `ui/mobile/assets/expo/icon.png`, `ui/mobile/assets/adaptive-icon.png`, `ui/mobile/assets/ios/AppIcon.appiconset/icon-1024.png` и `ui/mobile/ios/AlanGo/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`;
- **Инкремент номера сборки**:
  - `buildNumber` повышен до `4` (`CFBundleVersion: 4`, `CURRENT_PROJECT_VERSION: 4`) для отправки обновленного билда в TestFlight.

### 🍎 Авторизация через Apple ID и удаление аккаунта (Apple Guideline 5.1.1(v))
- **Нативная авторизация через Apple ID (`expo-apple-authentication`)**:
  - На экранах [`ui/mobile/app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx) и [`ui/mobile/app/register.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/register.tsx) добавлена нативная кнопка Apple Sign-In (`AppleAuthenticationButton`) в соответствии с Human Interface Guidelines Apple;
  - В [`ui/mobile/lib/registration.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/registration.ts) реализована функция `loginWithApple()` с обращением к бэкенду `POST /api/auth/apple`, сохранением сессии и переходом на главный экран;
  - Корректная обработка отмены запроса пользователем (`ERR_REQUEST_CANCELED`);
- **Удаление аккаунта (Apple Review Guideline 5.1.1(v))**:
  - В профиле [`ui/mobile/app/(tabs)/profile.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/profile.tsx) добавлена кнопка «Удалить аккаунт» с подтверждением через Alert с разрушающим действием (`destructive`);
  - Функция `deleteAccountApi()` в `registration.ts` вызывает `DELETE /api/profile` (очистка БД, отзыв Apple-токенов через `RevokeAppleToken`, удаление медиа) и выполняет локальный сброс сессии;
- **Выход из аккаунта**:
  - Добавлена кнопка «Выйти из аккаунта» с очисткой токенов и перенаправлением на экран входа.

### 🛠️ Исправление ошибки валидации App Store (Invalid large app icon & build 3)
- **Ликвидация альфа-канала из иконки приложения (P0)**:
  - Иконки `ui/mobile/assets/icon.png`, `ui/mobile/assets/expo/icon.png`, `ui/mobile/assets/ios/AppIcon.appiconset/icon-1024.png` и `ui/mobile/ios/AlanGo/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png` переведены в 24-битный формат без альфа-канала (`hasAlpha: no`) с заливкой фирменного темного фона темы (`#080D0B`);
  - Устранена ошибка валидации App Store: `The large app icon in the asset catalog in AlanGo.app can't be transparent or contain an alpha channel`;
- **Инкремент номера сборки**:
  - `buildNumber` повышен до `3` (`CFBundleVersion: 3`, `CURRENT_PROJECT_VERSION: 3`) для исключения ошибки дублирования предыдущей отклонённой сборки;
- **Настройка генерации символов dSYM ([`ui/mobile/ios/Podfile`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/ios/Podfile))**:
  - Добавлена настройка `DEBUG_INFORMATION_FORMAT = dwarf-with-dsym` для Release-конфигурации в хуке `post_install`.

### 🚀 Подготовка релиза для Apple TestFlight (v1.0.0, build 2)
- **Конфигурация сборки ([`ui/mobile/app.json`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app.json), [`ui/mobile/ios/AlanGo/Info.plist`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/ios/AlanGo/Info.plist))**:
  - Зафиксирована версия `1.0.0` и номер сборки `buildNumber: "2"` (`CFBundleVersion: 2`);
  - Добавлены обязательные для ревью Apple описания разрешений `NSLocationWhenInUseUsageDescription` и `NSPhotoLibraryUsageDescription`;
  - Настроен `ITSAppUsesNonExemptEncryption: false` для автоматического прохождения экспортного контроля Apple;
- **Файл конфигурации EAS ([`ui/mobile/eas.json`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/eas.json))**:
  - Добавлены профили `production`, `preview`, `development` для сборки в облаке EAS и прямой выгрузки в TestFlight;
- **Валидация бандла и скрипт сборки ([`ui/mobile/scripts/build_testflight.sh`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/scripts/build_testflight.sh))**:
  - Успешно протестирован экспорт производственного JS-бандла (`npx expo export --platform ios`);
  - Создан единый bash-скрипт сборки с выбором облачного EAS Build или локального Xcode Archive.

### 🏟️ Полный редизайн экранов «Залы» (Alan Go Halls & Details Screen)
- **Компонент карточки зала [`ui/mobile/components/VenueCard.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/VenueCard.tsx)**:
  - Точное соответствие Screen 1 и 3 референса: широкоформатная обложка 16:9, плавающая кнопка избранного ♡, плашка рейтинга `★ 4.8 (124)`, адрес и динамическое расстояние `2,4 км`, цена `от 15 000 ₸ / час` и акцентная круглая зеленая кнопка `➔` (`colors.primary`);
- **Компонент модального окна фильтров [`ui/mobile/components/FilterModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/FilterModal.tsx)**:
  - Точное соответствие Screen 2: сетка видов спорта (Футбол, Теннис, Баскетбол, Волейбол, Сквош, Падл) с индикаторами выбора и галочками ✓, переключатель «Спорткомплекс / Отдельный зал», выбор максимальной цены за час, сетка удобств (Парковка, Раздевалка, Душ, Wi-Fi), кнопки «Сбросить» и «Показать (X)» с динамическим расчетом;
- **Обновление экрана каталога [`ui/mobile/app/(tabs)/items.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/items.tsx)**:
  - Компактный заголовок «Залы», кнопки геолокации и фильтра справа в шапке, поисковая строка в стиле `colors.surface`, горизонтальные чипы видов спорта, строка сортировки и динамический чип «Фильтры • X» при наличии активных фильтров;
- **Обновление экрана деталей зала [`ui/mobile/app/hall/[id].tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/hall/[id].tsx)**:
  - Точное соответствие Screen 4: верхняя Hero-галерея со счетчиком фото `📷 1/12`, плавающими кнопками `←`, «Поделиться» и «Избранное», метаданные зала, бейджи характеристик (вид спорта, вместимость 5×5, крытый тип), сегментные табы `[ О зале ]`, `[ Расписание ]`, `[ Отзывы ]`, сетка плиток удобств, и фиксированный Sticky Footer с ценой и кнопкой «Забронировать»;
- **Интеграция с дизайн-системой**:
  - Все цвета, шрифты, радиусы и отступы переведены на семантические токены `colors`, `radii`, `spacing`, `typography` из [`DESIGN_SYSTEM.md`](file:///Users/miko/MyProduction/AlanGo/DESIGN_SYSTEM.md).

### 💎 Мобильная Дизайн-Система (Alan Go Mobile Design System)
- **Создан эталонный стандарт [`DESIGN_SYSTEM.md`](file:///Users/miko/MyProduction/AlanGo/DESIGN_SYSTEM.md)**:
  - Закреплены 10 основополагающих разделов: принципы Dark Sports UI, семантические токены цветов (`#080D0B`, `#121A16`, `#1C2722`, `#00C968`, `#F04452`), типографика, 4px-шкала отступов, радиусы скругления элементов (12..28px), правила Liquid Glass, кнопки, карточки арен, таб-навигация и строгие правила для агентов разработки;
- **Программные токены темы ([`ui/mobile/theme/designSystem.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/theme/designSystem.ts), [`ui/mobile/constants/theme.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/constants/theme.ts))**:
  - Экспортированы типизированные константы `colors`, `typography`, `spacing`, `radii` для устранения хардкода цветов и отступов во всех компонентах;
- **Правило №8 в инструкции агентов ([`AGENTS.md`](file:///Users/miko/MyProduction/AlanGo/AGENTS.md))**:
  - Закреплено обязательное соблюдение дизайн-системы перед разработкой любого UI в проекте Alan Go.

### 🎨 Визуальный UI-аудит и устранение обрезки элементов (iOS & Android)
- **Устранение перекрытия контента плавающим Liquid Glass Tab Bar**:
  - На всех ключевых экранах табов (`app/(tabs)/index.tsx`, `items.tsx`, `events.tsx`, `notifications.tsx`, `profile.tsx`) и в экранах бизнес-кабинета (`business/staff.tsx`, `business/schedule.tsx`) увеличен нижний отступ скролла (`paddingBottom: 110`), гарантирующий свободную видимость и кликабельность нижних карточек и кнопок над капсульным меню;
- **Идеальное позиционирование кнопки «Сохранить» в Графике работы ([`ui/mobile/app/business/schedule.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/schedule.tsx))**:
  - Заголовку и подзаголовку задан `flex: 1` с `flexShrink: 1` и `numberOfLines={1}`, а кнопке «Сохранить» — `flexShrink: 0` с гармоничным отступом `paddingHorizontal: 16`, предотвращающий выталкивание и обрезку текста кнопки за правый край экрана;
- **Оптимизация кнопок действий в карточках персонала ([`ui/mobile/app/business/staff.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/staff.tsx))**:
  - Добавлена кнопка «Войти» / «Вы вошли», оптимизированы размеры под трехкнопочный ряд (`Войти`, `Позвонить`, `Отозвать`), исключены горизонтальные переносы на экранах любой плотности.

### 🛠️ Исправления по результатам технического аудита (P0, P1, P2, P3)
- **Гарантированный бэкап базы данных (P0)**:
  - В [`AGENTS.md`](file:///Users/miko/MyProduction/AlanGo/AGENTS.md) зафиксировано обязательное использование суперпользователя `postgres` (`docker exec -t alango-db pg_dump -U postgres alango`), исключающее создание пустых 134-байтовых архивов из-за отсутствия роли `alango`;
- **Устранение ошибок cron-воркера (P1)**:
  - В [`internal/worker/scheduler.go`](file:///Users/miko/MyProduction/AlanGo/internal/worker/scheduler.go) исправлены SQL-запросы: проверка истекших подписок переведена на таблицу `users` (`WHERE valid_until < NOW()`), очистка аналитики — на `app_analytics_events`;
  - Устранены спам-ошибки `relation "subscriptions" does not exist` и `relation "refresh_tokens" does not exist` в логах контейнера `alango-api`;
- **Ликвидация N+1 запросов в каталоге арен (P2)**:
  - В [`internal/sport/service.go`](file:///Users/miko/MyProduction/AlanGo/internal/sport/service.go) переписан метод `ListArenas`: залы для всех выбранных комплексов теперь подгружаются пакетным запросом `WHERE arena_id IN (?)`, что сокращает число запросов к БД с N+1 до 2;
- **Защита от состояния гонки (Race Condition / Double-booking) (P3)**:
  - В [`internal/sport/service.go`](file:///Users/miko/MyProduction/AlanGo/internal/sport/service.go) метод `CreateBooking` обернут в атомарную транзакцию `s.db.Transaction()`, предотвращающую параллельное бронирование одного слота двумя пользователями одновременно.

### 👥 Авторизация и быстрое переключение под сотрудниками команды
- **Быстрый вход под сотрудником в 1 клик ([`ui/mobile/app/business/staff.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/staff.tsx))**:
  - В карточке каждого сотрудника арены добавлена кнопка «Войти», позволяющая владельцу мгновенно переключиться на рабочую сессию сотрудника;
  - При активной сессии отображается статус-бейдж «● Вы вошли»;
- **Авторизация по номеру телефона сотрудника ([`ui/mobile/lib/registration.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/registration.ts), [`ui/mobile/lib/auth.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/auth.ts))**:
  - Реализован метод `loginAsStaff`: создание сессии с правами сотрудника арены (`staffRole`, `arenaId`);
  - Функция `loginWithEmail` теперь автоматически распознает телефон или имя любого добавленного сотрудника (например, `87001234567` или `Fer`) и авторизует его в бизнес-кабинете;
- **Индикация дежурного в шапке Бизнес-кабинета ([`ui/mobile/app/business/index.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/index.tsx))**:
  - В шапке отображается бейдж активного сотрудника смены («СОТРУДНИК СМЕНЫ 🔑» и имя).

### 🏆 Фаза 5: Маркетинг, Абонементы, Telegram-бот администратора и iOS Dynamic Island / Live Activity
- **Спортивные абонементы и пакеты тренировок (Subscriptions & Multi-pass)**:
  - Создан модуль данных [`ui/mobile/lib/subscriptionsData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/subscriptionsData.ts) (`SubscriptionPackage`, `UserSubscription`, расчет выгоды до 25%, персистентность в `AsyncStorage`);
  - Разработан экран [`ui/mobile/app/subscriptions.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/subscriptions.tsx):
    - Вкладка «Витрина пакетов» (хиты сезона: «Футбольный Марафон» 8 игр, «Баскетбольный Безлимит» 12 тренировок, «Падел & Теннис Клаб» 6 часов);
    - Оформление через Kaspi QR и Банковские карты с мгновенной генерацией цифрового пропуска;
    - Вкладка «Мои абонементы» с прогресс-баром остатка посещений и модальным окном электронного QR-пропуска для турникета арены;
  - Добавлены карточки прямого перехода в абонементы на Главном экране (`index.tsx`) и в Профиле (`profile.tsx`).
- **Маркетинг, Счастливые часы и динамическое ценообразование**:
  - Создан модуль [`ui/mobile/lib/promotionsData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/promotionsData.ts) (механики «Дневные Счастливые Часы» -20% с 10:00 до 16:00 в будни, «Горящие вечерние слоты» -30%, приветственный промокод «STARTALAN»);
  - Разработан экран управления акциями в Бизнес-кабинете [`ui/mobile/app/business/promotions.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/promotions.tsx);
  - В карточку спорткомплекса [`ui/mobile/app/arena/[id].tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/arena/[id].tsx) добавлен бейдж «Счастливые часы: -20%» для дневных слотов.
- **Telegram-бот для администраторов спорткомплексов**:
  - Создан бэкенд-сервис [`internal/telegram/bot.go`](file:///Users/miko/MyProduction/AlanGo/internal/telegram/bot.go) и HTTP-хэндлер [`internal/telegram/handler.go`](file:///Users/miko/MyProduction/AlanGo/internal/telegram/handler.go):
    - Мгновенная отправка форматированных уведомлений в Telegram администратору арены при бронировании (комплекс, зал, дата, слот, клиент, телефон, сумма);
    - Инлайн-кнопки действий в Telegram: `[✅ Подтвердить бронь]`, `[💬 Чат с клиентом]`, `[🟢 WhatsApp]`;
    - Зарегистрированы эндпоинты `POST /api/business/telegram/notify` и `GET /api/business/telegram/status` в [`internal/router/router.go`](file:///Users/miko/MyProduction/AlanGo/internal/router/router.go).
- **iOS Dynamic Island & Live Activity (Экран матча)**:
  - Создан интерактивный компонент [`ui/mobile/components/LiveMatchIsland.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/LiveMatchIsland.tsx):
    - Плавающая капсула Dynamic Island с пульсирующим зеленым индикатором «LIVE • До матча 42 мин»;
    - Раскрытие по тапу с информацией о площадке, кнопкой быстрого маршрута в 2GIS / Карты и показом QR-пропуска;
    - Интегрирован на Главном экране мобильного приложения.

## [1.5.1] — 2026-11-06

### 🎨 Редизайн Liquid Glass навигации (Floating Capsule Tab Bar в стиле Vison)
- **Устранение ошибки `<ViewManagerAdapter_ExpoBlur_ExpoBlurView>`**:
  - В [`ui/mobile/components/TabBarGlassBackground.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/TabBarGlassBackground.tsx) добавлена динамическая проверка доступности нативного модуля `UIManager.hasViewManagerConfig('ExpoBlurView')` с красивым полупрозрачным фолбэком для Expo Go.
- **Новый плавающий компонент навигации**:
  - Создан компонент [`ui/mobile/components/LiquidGlassTabBar.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/LiquidGlassTabBar.tsx) в стиле iOS Liquid Glass:
    - Плавающая капсула (`tabBarPill`) с радиусом скругления `33px`, эффектом матового стекла и тонкой светящейся каймой;
    - Активная вкладка подсвечивается овальной капсулой с изумрудным градиентным фоном и зеленым акцентным цветом иконки и подписи (полное совпадение с дизайном референса Vison);
    - Отсутствие обрезки текста ("Главная", "Залы", "События", "Чат", "Профиль" отображаются полностью и аккуратно);
  - Подключен в [`ui/mobile/app/(tabs)/_layout.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/_layout.tsx) через кастомный `tabBar` проп;
  - Подавлены всплывающие отладочные предупреждения в dev-режиме [`ui/mobile/app/_layout.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/_layout.tsx).

## [1.5.0] — 2026-11-06

### 💼 Фаза 4: Кабинет Бизнеса, Выручка и Клиентская база (CRM)
- **Модели данных CRM и Финансовой аналитики**:
  - Создан модуль [`ui/mobile/lib/businessCrmData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/businessCrmData.ts):
    - `ClientProfile`: история игр, контактный телефон, суммарный оборот (LTV), статус клиента (*VIP*, *Постоянный*, *Новый*, *Ненадежный*), заметки администратора;
    - `StaffMember`: сотрудники арены, график смен, роли (*Старший админ*, *Менеджер смены*, *Дежурный тренер*, *Технический персонал*);
    - `calculateIncomeStats`: автоматический расчет выручки, среднего чека за час аренды, загруженности площадок (%) и структуры поступлений.
- **Экран финансовой аналитики и доходов ([`ui/mobile/app/business/income.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/income.tsx))**:
  - Герой-карточка фактической выручки с бейджем динамики (+18.4%);
  - Фильтры периодов: «Сегодня», «7 дней», «30 дней», «Все время»;
  - KPI-метрики: сыграно часов, средний чек за час (₸), процент загрузки кортов (74%);
  - Интерактивный прогресс-бар выручки по каждому отдельному залу комплекса с долей от общего дохода;
  - Список недавних транзакций с бейджами способов оплаты (Kaspi QR, Банковская карта, Наличные) и кнопка экспорта отчета.
- **Экран клиентской базы CRM ([`ui/mobile/app/business/clients.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/clients.tsx))**:
  - Поиск по имени и номеру телефона;
  - Быстрые сегментные фильтры («Все клиенты», «⭐ VIP», «Постоянные», «Новички»);
  - Карточки клиентов с метриками: число броней, совокупный LTV в тенге, дата последней активности;
  - Мгновенные действия: прямой звонок 📞, открытие переписки в WhatsApp 🟢 (`whatsapp://send?phone=...`), чат внутри приложения 💬.
- **Экран управления персоналом смен ([`ui/mobile/app/business/staff.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/staff.tsx))**:
  - Список дежурных менеджеров и тренеров комплекса;
  - Модальное окно добавления нового сотрудника с выбором роли, номера телефона и графика смен;
  - Возможность быстрого звонка или отзыва прав доступа.
- **Интеграция в панель Бизнес-кабинета**:
  - В [`ui/mobile/app/business/index.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/index.tsx) добавлен премиальный блок «Спортивная CRM и Аналитика» с карточками прямого перехода в Выручку, Клиентскую базу и Персонал;
  - В [`ui/mobile/app/business/_layout.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/_layout.tsx) зарегистрированы скрытые маршруты `income`, `clients`, `staff`.

## [1.4.0] — 2026-11-06

### 💬 Фаза 3: Коммуникация, Чаты, Чат-бот и Push-уведомления
- **In-App Real-Time чаты и диалоги**:
  - Создан модуль хранилища сообщений и диалогов [`ui/mobile/lib/chatData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/chatData.ts) с персистентностью в `AsyncStorage`, поддержкой реактивной подписки `subscribeToChats` и типизацией `ChatMessage` / `ChatDialog`.
  - Переработан экран [`ui/mobile/app/(tabs)/notifications.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/notifications.tsx):
    - Вкладка «Сообщения» со списком активных диалогов спорткомплексов, аватарами, индикаторами онлайн, бейджами непрочитанных сообщений и временем последнего сообщения;
    - Навигация в полноэкранное окно переписки по тапу на диалог.
- **Интерактивное окно чата (`ui/mobile/app/chat/[id].tsx`)**:
  - Кастомная шапка с аватаром арены, бейджем верифицированного AI-ассистента («AI-Бот ответит за 1 сек») и кнопкой быстрого звонка;
  - Стилизованные пузыри сообщений (клиент — изумрудный градиент, бизнес — карточка, AI-бот — темная карточка со светящимся бейджем «BOT»);
  - Виджет карточки бронирования внутри сообщения (зал, дата, время, сумма, статус «Активно»);
  - Панель быстрых подсказок (чипы: «Обувь и шипы», «Мячи и инвентарь», «Парковка», «Раздевалки и душ», «Свободные слоты»);
  - Индикатор набора текста («Ассистент печатает...»).
- **Умный Чат-бот спортивного комплекса (`ui/mobile/lib/arenaChatBot.ts`)**:
  - База знаний по спортивным покрытиям (сороконожки TF, футзалки, запрет металлических шипов);
  - Инвентарь (бесплатная выдача мячей и манишек на ресепшн, прокат ракеток);
  - Парковка (бесплатная охраняемая стоянка, проезд через шлагбаум);
  - Раздевалки, душ, индивидуальные шкафчики и полотенца;
  - Правила отмены за 12 часов с возвратом средств;
  - Интеграция кнопки быстрого перехода в чат прямо со страницы арены ([`ui/mobile/app/arena/[id].tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/arena/[id].tsx)).
- **Сервис Push-уведомлений (`ui/mobile/lib/pushNotificationsService.ts`)**:
  - Интеграция с `expo-notifications` для локальных push-уведомлений со звуком и баннером;
  - Оповещение игрока о подтверждении брони (`notifyBookingConfirmed`);
  - Оповещение об отклонении с указанием конкретной причины (`notifyBookingRejected`);
  - Напоминание за 2 часа до игры (`notifyUpcomingGame`);
  - Оповещение о новых сообщениях в чате (`notifyNewChatMessage`).
- **UX и Исправления**:
  - В [`ui/mobile/components/TabBarGlassBackground.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/TabBarGlassBackground.tsx) убран устаревший параметр `experimentalBlurMethod="dimezisBlurView"`, вызывавший артефакты в Expo Go.

## [1.3.0] — 2026-11-06

### 📅 Фаза 2: Профессиональное расписание, Каскадный график и Календарь 3-в-1
- **Каскадный график доступности и границы расписания**:
  - В модель `ScheduleDay` ([`ui/mobile/lib/sportRentData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/sportRentData.ts)) добавлены параметры каскадной сетки: `cascadeEnabled`, `cascadeStepHours`, `cascadeInitialEndTime`, `cascadeSecondBoundaryTime`, `cascadeCutoffTime`.
  - В экран расписания бизнеса ([`ui/mobile/app/business/schedule.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/schedule.tsx)) добавлена интерактивная карточка настройки каскадного графика:
    - Переключатель активации каскада;
    - Чипы выбора шага каскадного смещения (+1 ч, +2 ч, +3 ч, +4 ч);
    - Поля настройки первой и второй границы (окна доступности) и времени отсечки (Cutoff);
    - Кнопка синхронизации настроек каскада на всю неделю («Применить ко всем дням»).
- **Интерактивный 3-в-1 Календарь бронирований**:
  - Создан компонент [`ui/mobile/components/BookingsCalendar.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/BookingsCalendar.tsx) с тремя режимами отображения:
    - **Режим «День»**: почасовая шкала (08:00 — 23:00), визуальные карточки занятых слотов с цветовой кодировкой статуса, имя и телефон клиента, быстрый звонок в один клик, подтверждение брони, отклонение и фиксация исхода матча.
    - **Режим «Неделя»**: горизонтальная лента дней текущей недели с подсветкой сегодняшнего дня, индикатором количества активных броней и быстрой навигацией.
    - **Режим «Месяц»**: полноценная календарная сетка месяца с индикаторами занятости дней, переключением месяцев и выбором интересующей даты.
- **Быстрая ручная запись клиентов (Manual Booking)**:
  - Разработан модальный компонент [`ui/mobile/components/ManualBookingModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/ManualBookingModal.tsx):
    - Селектор доступных залов арены с ценой в час;
    - Поля ввода имени и номера телефона клиента (с цифровой клавиатурой phone-pad);
    - Быстрый выбор даты («Сегодня», «Завтра», «Послезавтра» или произвольная дата);
    - Чипы типовых таймслотов (09:00, 10:00, 11:00, 18:00, 19:00, 20:00 и т.д.);
    - Поле суммы бронирования с автоподстановкой тарифа зала, суммы предоплаты и заметок менеджера;
    - Мгновенное сохранение в локальное хранилище и синхронизация с сервером.
- **Обоснованный отказ и фиксация исхода матча**:
  - Разработан компонент [`ui/mobile/components/RejectBookingModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/RejectBookingModal.tsx) с обязательным указанием причины отклонения (ремонт/техобслуживание, занято постоянной лигой, не подтверждено по телефону, форс-мажор, произвольная причина).
  - В модель `Booking` добавлены поля `rejectionReason` и `gameOutcome` (`completed` / `no_show`).
  - Реализованы функции `rejectBookingWithReason` и `setBookingGameOutcome` с обновлением статуса и тактильным откликом.
- **Интеграция экрана управления бронями**:
  - В [`ui/mobile/app/business/bookings.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/business/bookings.tsx) встроен переключатель между режимом «Календарь (3-в-1)» и режимом «Список», подключены модальные окна ручной записи и отклонения, а также отображение причин отказа и бейджей исхода игры.

## [1.2.1] — 2026-11-06

### 🔒 Безопасность и Инфраструктура
- **Разделение Git-профилей (Personal / Work)**:
  - Настроен файл `~/.gitconfig-personal` с личными данными разработчика (`Miko Dev` <`mikos.zh8@gmail.com`>).
  - Настроен `includeIf "gitdir:~/MyProduction/"` в глобальном `~/.gitconfig` для автоматического использования личного GitHub-профиля во всех проектах каталога `~/MyProduction/`.
- **Санитизация секретов**:
  - Удалены тестовые SMTP-учетные данные из файла [`.env.example`](file:///Users/miko/MyProduction/AlanGo/.env.example), заменены на безопасные плейсхолдеры.

## [1.2.0] — 2026-11-06

### 🎨 Фаза 1: Премиальный UX (Liquid Glass), География Казахстана и Спортивные Фильтры
- **Стеклянный навигационный бар (Liquid Glass & Blur)**:
  - Установлен и настроен пакет `expo-blur`.
  - Создан компонент [`ui/mobile/components/TabBarGlassBackground.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/TabBarGlassBackground.tsx) с нативным системным размытием `BlurView` (`systemChromeMaterialDark`), подложкой `rgba(11, 15, 13, 0.72)` и ультратонкой линией-разделителем `hairline`.
  - В [`ui/mobile/app/(tabs)/_layout.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/_layout.tsx) таб-бар переведён в плавающий прозрачный режим (`position: absolute`) с тактильным откликом Haptics (`hapticSelection()`) при переключении любого таба.
- **База городов Казахстана и Интерактивный Селектор**:
  - Создан модуль [`ui/mobile/lib/cities.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/cities.ts) с базой из 45+ городов Казахстана (Астана, Алматы, Шымкент, 17 областных центров и районные города) с сохранением выбора в `AsyncStorage` и подпиской на изменения.
  - Разработан компонент [`ui/mobile/components/CityPickerModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/CityPickerModal.tsx) с быстрыми чипами топ-городов, строкой мгновенного поиска и алфавитным списком городов с отметкой выбранного.
  - Добавлены сидовые площадки и залы для Алматы (`Almaty Arena`, `Dostyk Padel & Tennis Club`) и Шымкента (`Shymkent Grand Arena`) в [`ui/mobile/lib/sportRentData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/sportRentData.ts).
- **Полноэкранный спортивный мульти-фильтр**:
  - Создан компонент [`ui/mobile/components/SportSearchFiltersModal.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/components/SportSearchFiltersModal.tsx):
    - Мультивыбор видов спорта (Футбол, Теннис, Баскетбол, Волейбол, Падел, Настольный теннис).
    - Выбор типов покрытия (Искусственный/натуральный газон, паркет, терафлекс, хард, резина).
    - Выбор ценового диапазона в час (До 10 000 ₸, 10 000 — 20 000 ₸, от 20 000 ₸).
    - Чекбоксы удобств и инвентаря (Душевые, раздевалки, парковка, освещение, трибуны, сауна, аренда мячей/манишек).
    - Динамический счетчик подходящих площадок на нижней кнопке применения («Показать X площадок →») и кнопка быстрого сброса.
  - В шапку главной страницы рядом со строкой поиска добавлена кнопка фильтров с бейджем активных фильтров.
  - Подключена фильтрация площадок и залов на лету с карточкой пустого состояния («Площадки не найдены») и кнопкой сброса при отсутствии результатов.

---

## [1.1.0] — 2026-11-05

### 📚 Архитектурный аудит и Дорожная карта (Roadmap)
- **Детальный каталог возможностей Vison (`docs/VISION_CAPABILITIES_CATALOG.md`)**:
  - Задокументирован полный технический и архитектурный эталон из кодовой базы Vison (`FotoLink`).
  - Описаны 14 ключевых модулей: каскадные графики и границы расписания, PostgreSQL GIST-ограничения от овербукинга, календарь 3-в-1 (Месяц/Неделя/День), быстрая ручная запись за 10 секунд, Real-Time чаты, умный чат-бот автоответчик с 3 режимами, прямые Push-уведомления (FCM v1 + APNs), Liquid Glass навигация, фотогалерея зон, справочник 45+ городов Казахстана, спортивные мульти-фильтры, CRM для бизнеса, абонементы и интеграция с Dynamic Island / Live Activity.
- **Дорожная карта AlanGo (`docs/ALANGO_ROADMAP.md`)**:
  - Сформирован структурированный план развития проекта, разбитый на 5 последовательных фаз:
    1. *Фаза 1*: Премиальный UX (Liquid Glass), база всех городов Казахстана, спортивные фильтры и фотогалерея.
    2. *Фаза 2*: Профессиональное расписание (Каскадный график, календарь 3-в-1, ручная запись `+ Новая бронь`).
    3. *Фаза 3*: Коммуникация, In-App чаты, Чат-бот автоответчик и FCM Push-уведомления.
    4. *Фаза 4*: Кабинет бизнеса, финансовая аналитика (выручка), CRM команд и игроков.
    5. *Фаза 5*: Маркетинг, абонементы, Telegram-бот для администраторов и iOS Dynamic Island.

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

### 📧 Почтовый сервис (SMTP) и подтверждение регистрации
- **Интеграция SMTP на сервере VPS**:
  - Подключен почтовый сервис `mail.vison.kz:465` (SSL) с аккаунтом `no_reply@vison.kz`.
  - Установлен красивый заголовок отправителя `SMTP_FROM=AlanGo <no_reply@vison.kz>`.
  - Проверена прямая отправка писем с 6-значными кодами подтверждения регистрации на реальные почтовые ящики.
- **Двухэтапная регистрация в мобильном приложении ([`app/register.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/register.tsx))**:
  - Реализован двухшаговый процесс:
    1. Заполнение имени, email и пароля ➔ запрос кода на почту.
    2. Ввод 6-значного проверочного кода с крупным моноширинным шрифтом, таймером обратного отсчета повторной отправки (60 сек) и возможностью изменить адрес.
  - При подтверждении кода аккаунт создается в базе данных и происходит автоматический вход в систему.

### 📱 Мобильное приложение (iOS / Expo 57)
- **Иерархия спорткомплексов и аренда залов (Бизнес-модель)**:
  - Реализован каталог с сегментированным переключателем: **«Спорткомплексы»** (здания с несколькими залами) и **«Отдельные залы»** ([`app/(tabs)/items.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/items.tsx)).
  - Добавлены фильтры по районам (Есиль, Нура, Алматы) и видам спорта (Футбол, Баскетбол, Теннис, Волейбол, Сквош и падл).
  - Создан детальный экран спорткомплекса ([`app/arena/[id].tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/arena/[id].tsx)) с инфраструктурой, фото, залами и графиком работы.
  - На главном экране ([`app/(tabs)/index.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/(tabs)/index.tsx)) добавлена горизонтальная карусель спорткомплексов и арен.
- **Исправление иконки приложения (Home Screen)**:
  - Убран внутренний текст *"Alan Go"* из изображения иконки, вызывавший визуальное дублирование названия под иконкой iOS.
  - Взят чистый векторный ассет из `template_image/icon-improved1.svg` (стилизованная неоновая буква **A** с мячом без надписей) и сгенерированы 1024×1024 ассеты для iOS и Expo.
- **Аутентификация и гостевой режим ([`app/login.tsx`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/app/login.tsx))**:
  - Добавлена кнопка **«Войти как гость»** в шапке экрана, быстрая карточка в блоке тестовых аккаунтов и полноразмерная кнопка под формой для входа в 1 касание.
- **Стабилизация нативной маршрутизации Expo Router**:
  - Добавлен корневой [`ui/mobile/index.js`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/index.js), восстановивший прямую загрузку живого бандла с Metro в bare React Native.
  - Выпрямлена иерархия бизнес-кабинета (`app/business/schedule.tsx`, `halls.tsx`, `bookings.tsx`, `profile.tsx`), полностью устранен сбой `Unmatched Route: /business/schedule`.
- **Синхронизация данных с бэкендом Go**:
  - В [`sportRentData.ts`](file:///Users/miko/MyProduction/AlanGo/ui/mobile/lib/sportRentData.ts) добавлен двусторонний маппер `snake_case` <-> `camelCase` для арен, залов, расписаний и броней, устранивший ошибки отображения `undefined` в графике работы.
- **Брендинг**:
  - Полностью вычищены устаревшие упоминания стороннего сервиса *"Vison"*, везде установлен бренд **AlanGo**.
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
