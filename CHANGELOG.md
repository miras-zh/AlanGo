# Changelog

Все важные изменения проекта **AlanGo** документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
версионирование следует [Семантическому версионированию (SemVer)](https://semver.org/lang/ru/).

---

## [1.6.0] — 2026-11-06

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
