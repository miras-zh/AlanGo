-- ============================================================================
-- 000002_sport_domain.up.sql
-- Domain tables for AlanGo:
--   1. arenas (Sports complexes, arenas, sports business hubs)
--   2. halls (Individual sports grounds and courts)
--   3. arena_schedules (Weekly operational schedule & slot durations)
--   4. bookings (Client and manual bookings)
--   5. Initial seed data for Astana Arenas and Halls
-- ============================================================================

CREATE TABLE IF NOT EXISTS arenas (
    id                   BIGSERIAL PRIMARY KEY,
    owner_id             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    owner_email          VARCHAR(255) NOT NULL DEFAULT '',
    title                VARCHAR(255) NOT NULL,
    category             VARCHAR(100) NOT NULL DEFAULT 'Спорткомплекс',
    district             VARCHAR(100) NOT NULL DEFAULT '',
    city                 VARCHAR(100) NOT NULL DEFAULT 'Астана',
    address              VARCHAR(255) NOT NULL,
    phone                VARCHAR(50)  NOT NULL DEFAULT '',
    rating               NUMERIC(3,2) NOT NULL DEFAULT 4.8,
    reviews_count        INTEGER      NOT NULL DEFAULT 0,
    image_url            TEXT         NOT NULL DEFAULT '',
    description          TEXT         NOT NULL DEFAULT '',
    features             TEXT[]       NOT NULL DEFAULT '{}',
    working_hours        VARCHAR(100) NOT NULL DEFAULT '08:00 - 23:00 (ежедневно)',
    halls_count          INTEGER      NOT NULL DEFAULT 0,
    min_price_per_hour   INTEGER      NOT NULL DEFAULT 12000,
    sports               TEXT[]       NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arenas_owner_id ON arenas (owner_id);
CREATE INDEX IF NOT EXISTS idx_arenas_city_district ON arenas (city, district);
CREATE INDEX IF NOT EXISTS idx_arenas_rating ON arenas (rating DESC);

CREATE TABLE IF NOT EXISTS halls (
    id                   BIGSERIAL PRIMARY KEY,
    arena_id             BIGINT       NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    title                VARCHAR(255) NOT NULL,
    sport_type           VARCHAR(100) NOT NULL,
    surface_type         VARCHAR(255) NOT NULL DEFAULT '',
    equipment            TEXT[]       NOT NULL DEFAULT '{}',
    capacity             VARCHAR(100) NOT NULL DEFAULT '',
    price_per_hour       INTEGER      NOT NULL DEFAULT 12000,
    image_url            TEXT         NOT NULL DEFAULT '',
    status               VARCHAR(50)  NOT NULL DEFAULT 'active',
    description          TEXT         NOT NULL DEFAULT '',
    rating               NUMERIC(3,2) NOT NULL DEFAULT 4.8,
    reviews_count        INTEGER      NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_halls_arena_id ON halls (arena_id);
CREATE INDEX IF NOT EXISTS idx_halls_sport_type ON halls (sport_type);
CREATE INDEX IF NOT EXISTS idx_halls_status ON halls (status);

CREATE TABLE IF NOT EXISTS arena_schedules (
    id                   BIGSERIAL PRIMARY KEY,
    arena_id             BIGINT       NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    day_of_week          INTEGER      NOT NULL, -- 0 = Воскресенье, 1 = Понедельник ... 6 = Суббота
    day_name             VARCHAR(50)  NOT NULL,
    is_closed            BOOLEAN      NOT NULL DEFAULT FALSE,
    start_time           VARCHAR(10)  NOT NULL DEFAULT '08:00',
    end_time             VARCHAR(10)  NOT NULL DEFAULT '23:00',
    slot_durations       INTEGER[]    NOT NULL DEFAULT '{60, 90}',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_arena_day UNIQUE (arena_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_schedules_arena ON arena_schedules (arena_id);

CREATE TABLE IF NOT EXISTS bookings (
    id                   BIGSERIAL PRIMARY KEY,
    booking_code         VARCHAR(50)  NOT NULL UNIQUE,
    hall_id              BIGINT       NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    arena_id             BIGINT       NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    user_id              BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    client_name          VARCHAR(255) NOT NULL,
    client_phone         VARCHAR(50)  NOT NULL,
    booking_date         VARCHAR(50)  NOT NULL, -- "2026-11-05" или "Сегодня"
    time_slot            VARCHAR(50)  NOT NULL, -- "19:00 - 20:00"
    start_time           VARCHAR(10)  NOT NULL DEFAULT '19:00',
    end_time             VARCHAR(10)  NOT NULL DEFAULT '20:00',
    duration_minutes     INTEGER      NOT NULL DEFAULT 60,
    total_price          INTEGER      NOT NULL DEFAULT 0,
    status               VARCHAR(50)  NOT NULL DEFAULT 'confirmed', -- confirmed, pending, cancelled, completed
    payment_status       VARCHAR(50)  NOT NULL DEFAULT 'pending',
    notes                TEXT         NOT NULL DEFAULT '',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_arena_date ON bookings (arena_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_hall_date  ON bookings (hall_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id    ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings (status);

-- ============================================================================
-- SEED DATA: 4 ARENAS & 11 HALLS
-- ============================================================================

INSERT INTO arenas (id, owner_email, title, category, district, city, address, phone, rating, reviews_count, image_url, description, features, working_hours, halls_count, min_price_per_hour, sports)
VALUES
(1, 'dev.arena1@sportrent.kz', 'Astana Arena Sport', 'Спорткомплекс', 'Есиль', 'Астана', 'ул. Нур-Султан 12', '+7 (701) 111-22-33', 4.8, 124,
 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
 'Крупнейший спортивный комплекс столицы с 3 специализированными залами для командных и индивидуальных видов спорта.',
 ARRAY['Бесплатная парковка на 100 мест', 'Раздевалки с душем и фенами', 'Кафе и спорт-бар', 'Сауна', 'Прокат экипировки', 'Трибуны для зрителей'],
 '08:00 - 24:00 (ежедневно)', 3, 14000, ARRAY['Футбол', 'Баскетбол', 'Теннис']),

(2, 'dev.arena2@sportrent.kz', 'Nomad Pro Complex', 'Премиум спорткластер', 'Есиль', 'Астана', 'пр. Туран 54', '+7 (702) 444-55-66', 4.9, 98,
 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
 'Премиальный спортивный кластер с паркетом олимпийского уровня, футбольным манежем и панорамным падл-кортом.',
 ARRAY['Подземный теплый паркинг', 'Индивидуальные шкафчики с кодовым замком', 'Фитнес-смузи бар', 'Прокат ракеток и мячей', 'Высокоскоростной Wi-Fi', 'Профессиональная вентиляция'],
 '07:00 - 23:00 (ежедневно)', 3, 12000, ARRAY['Футбол', 'Баскетбол', 'Сквош и падл']),

(3, 'daulet@sportrent.kz', 'Daulet Tennis & Padel Club', 'Теннисный центр', 'Нура', 'Астана', 'пр. Кабанбай батыра 6/1', '+7 (7172) 44-55-66', 4.9, 142,
 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800',
 'Национальный ракетный центр: 2 крытых профессиональных корта, панорамный корт для сквоша и падел-тенниса.',
 ARRAY['Профессиональное покрытие Hard Cushion', 'Магазин экипировки и натяжка струн', 'Сауна и ледяная купель', 'Кофейня со спортивным меню', 'Парковка с зарядкой для электромобилей'],
 '07:00 - 23:00 (ежедневно)', 2, 16000, ARRAY['Теннис', 'Сквош и падл']),

(4, 'barys@sportrent.kz', 'Barys Universal Arena', 'Спорткомплекс', 'Есиль', 'Астана', 'пр. Туран 57', '+7 (7172) 61-33-00', 4.8, 175,
 'https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800',
 'Многофункциональный комплекс для игровых видов спорта: мини-футбол, баскетбол, волейбол и командные тренировки.',
 ARRAY['Вместительные трибуны', 'Просторные раздевалки', 'Электронные табло со звуковым таймером', 'Прокат мячей и инвентаря', 'Спортивный массажный кабинет'],
 '08:00 - 23:00 (ежедневно)', 3, 10000, ARRAY['Футбол', 'Баскетбол', 'Волейбол'])
ON CONFLICT (id) DO NOTHING;

SELECT setval('arenas_id_seq', (SELECT MAX(id) FROM arenas));

INSERT INTO halls (id, arena_id, title, sport_type, surface_type, equipment, capacity, price_per_hour, image_url, status, description, rating, reviews_count)
VALUES
(101, 1, 'Футбольный зал Arena 1', 'Футбол', 'Искусственный газон 60 мм (FIFA Quality Pro)',
 ARRAY['Бестеневой LED-свет 500 Lux', 'Ворота 3х2 м с сеткой-гасителем', 'Электронное табло со счетом и таймером', 'Профессиональные мячи Select & Nike', 'Комплект манишек (синие, красные)', 'Раздевалка с 12 душевыми кабинами'],
 '5x5 / 6x6 (до 14 человек)', 15000, 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800', 'active',
 'Профессиональный крытый манеж с мягким наполнителем газона. Отличная амортизация для снижения нагрузки на суставы.', 4.8, 124),

(102, 1, 'Баскетбольный зал Arena Basket', 'Баскетбол', 'Амортизационный трёхслойный паркет (канадский клён)',
 ARRAY['Гидравлические мобильные стойки Spalding', 'Стеклянные щиты с кольцами Pro Image', 'Табло счета с индикацией 24 секунд', 'Мячи Molten GG7X и Wilson Solution', 'Судейский столик с микрофоном', 'Музыкальная акустика по залу'],
 '5x5 (стандартное поле FIBA)', 14000, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800', 'active',
 'Соревновательный зал с великолепным сцеплением паркета и комфортным освещением без бликов.', 4.7, 89),

(103, 1, 'Теннисный корт Arena Tennis', 'Теннис', 'Hard Cushion с 7-слойным смягчением',
 ARRAY['Теннисная сетка европейского стандарта', 'Судейская вышка', 'Пушка для подачи мячей (Spinshot)', 'Прокат ракеток Wilson & Head', 'Корзины для сбора мячей', 'Зона отдыха с кулером'],
 'Одиночный или парный разряд (до 4 чел)', 16000, 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800', 'active',
 'Крытый корт со стабильным отскоком мяча и терморегуляцией (+20°C круглый год).', 4.9, 156),

(201, 2, 'Футбольный манеж Nomad Turf', 'Футбол', 'Синтетический монофиламентный газон 50 мм',
 ARRAY['LED-прожекторы высокой четкости', 'Ворота с защитными матами', 'Мячи Adidas Tiro League', 'Манишки 3 цветов', 'Душевые с термостатом', 'Музыкальная колонка Bluetooth'],
 '5x5 (до 12 человек)', 13000, 'https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800', 'active',
 'Уютный всепогодный манеж для любительских матчей и тренировок с отличной вентиляцией.', 4.8, 74),

(202, 2, 'Баскетбольный корт Nomad Court', 'Баскетбол', 'Спортивный дубовый паркет с пружинящей подложкой',
 ARRAY['Профессиональные кольца с амортизатором', 'Электронное двухстороннее табло', 'Мячи Wilson Evolution (размер 7 и 6)', 'Отдельная раздевалка с полотенцами', 'Пит-стоп с изотониками'],
 '5x5 / 3x3', 12000, 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800', 'active',
 'Премиальная площадка для тренировок, стритбол-турниров и корпоративных игр.', 4.7, 65),

(203, 2, 'Сквош и Падл корт Nomad Padel', 'Сквош и падл', 'Панорамное закаленное стекло 12 мм + моноволоконный ковер',
 ARRAY['Панорамный обзор 360°', 'Профессиональная сетка для падла', 'Ракетки Bullpadel & Babolat в прокат', 'Мячи Head Padel Pro', 'Запись игры на видеокамеру'],
 'Парная игра (4 человека)', 14000, 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800', 'active',
 'Самый современный падл-корт в городе. Полное соответствие нормативам World Padel Tour.', 4.9, 110),

(301, 3, 'Центральный корт Grand Slam', 'Теннис', 'Hard Cushion турнирного уровня ITF',
 ARRAY['Профессиональное бестеневое освещение 800 Lux', 'Судейская вышка и электронный счет', 'Пушка для тренировки ударов', 'Ракетки Head Speed & Wilson Pro Staff', 'Раздевалки с сауной и полотенцами'],
 'Одиночный или парный разряд (до 4 чел)', 18000, 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800', 'active',
 'Центральный крытый корт национального уровня с мягким покрытием и климат-контролем.', 4.9, 142),

(302, 3, 'Панорамный падл-корт Sky Padel', 'Сквош и падл', 'Испанский монофиламентный ковер + стекло 12 мм',
 ARRAY['Панорамный стеклянный борт без перекладин', 'Профессиональная натяжная сетка', 'Прокат топовых ракеток Nox & Bullpadel', 'Мячи Bullpadel Gold'],
 'Парная игра (4 человека)', 16000, 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800', 'active',
 'Светлый панорамный корт с высокими потолками (10 м) для идеальной игры в падл в любую погоду.', 4.9, 96),

(401, 4, 'Футзальный манеж Barys', 'Футбол', 'Спортивный полиуретановый терафлекс 8 мм',
 ARRAY['Стандартные футзальные ворота 3x2 м', 'Мячи с низким отскоком Select Futsal Super', 'Электронное настенное табло', 'Трибуны на 200 зрителей', 'Раздевалки с душем'],
 '5x5 (до 14 человек)', 14000, 'https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800', 'active',
 'Универсальный соревновательный манеж для мини-футбола с удобным покрытием и трибунами.', 4.8, 130),

(402, 4, 'Баскетбольная арена Pro', 'Баскетбол', 'Паркетная доска из клена Junckers (сертификат FIBA)',
 ARRAY['Профессиональные гидро-щиты Schelde Sports', 'Секундомер атаки 24 сек', 'Мячи Spalding TF-1000', 'Судейский столик'],
 '5x5 (стандарт FIBA)', 12000, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800', 'active',
 'Просторная арена с трибунами для баскетбольных матчей и тренировок.', 4.7, 88),

(403, 4, 'Волейбольный зал Olympus', 'Волейбол', 'Французский Gerflor Taraflex Surface',
 ARRAY['Профессиональные алюминиевые волейбольные стойки', 'Сетка с антеннами и карманами', 'Судейская вышка', 'Мячи Mikasa V200W (олимпийский стандарт)', 'Защитные протекторы на стойках'],
 '6x6 (до 16 человек)', 10000, 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800', 'active',
 'Специализированный волейбольный зал с покрытием олимпийского стандарта для максимального комфорта прыжков.', 4.8, 64)
ON CONFLICT (id) DO NOTHING;

SELECT setval('halls_id_seq', (SELECT MAX(id) FROM halls));

-- ============================================================================
-- SEED SCHEDULES (DAYS 0-6 FOR ALL 4 ARENAS)
-- ============================================================================

INSERT INTO arena_schedules (arena_id, day_of_week, day_name, is_closed, start_time, end_time, slot_durations)
SELECT a.id, d.day_of_week, d.day_name, false, '08:00', '23:00', ARRAY[60, 90]
FROM arenas a
CROSS JOIN (
    VALUES
    (1, 'Понедельник'),
    (2, 'Вторник'),
    (3, 'Среда'),
    (4, 'Четверг'),
    (5, 'Пятница'),
    (6, 'Суббота'),
    (0, 'Воскресенье')
) AS d(day_of_week, day_name)
ON CONFLICT (arena_id, day_of_week) DO NOTHING;

-- Seed Sample Bookings
INSERT INTO bookings (id, booking_code, hall_id, arena_id, client_name, client_phone, booking_date, time_slot, start_time, end_time, duration_minutes, total_price, status)
VALUES
(1, 'SR-101', 101, 1, 'Ерлан Сарсенов', '+7 (705) 555-12-34', 'Сегодня', '19:00 - 20:00', '19:00', '20:00', 60, 15000, 'confirmed'),
(2, 'SR-102', 102, 1, 'Алихан Бахыт', '+7 (778) 999-88-77', 'Сегодня', '20:00 - 21:30', '20:00', '21:30', 90, 21000, 'confirmed'),
(3, 'SR-201', 203, 2, 'Диас Маратов', '+7 (701) 333-77-11', 'Завтра', '18:00 - 19:30', '18:00', '19:30', 90, 21000, 'confirmed')
ON CONFLICT (id) DO NOTHING;

SELECT setval('bookings_id_seq', (SELECT MAX(id) FROM bookings));
