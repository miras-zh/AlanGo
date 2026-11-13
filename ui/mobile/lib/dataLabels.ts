import { tr, type MessageKey, type TFunction } from "@/lib/i18n";

// Display labels for values that are stored (and sent to the backend) in
// Russian: sport types, surfaces, weekdays. The stored value never changes —
// only what the user sees is translated. Unknown values are shown as-is.

const SPORT_KEYS: Record<string, MessageKey> = {
  "Все": "sport.all",
  "Футбол": "sport.football",
  "Мини-футбол": "sport.miniFootball",
  "Баскетбол": "sport.basketball",
  "Теннис": "sport.tennis",
  "Волейбол": "sport.volleyball",
  "Сквош и падл": "sport.squashPadel",
  "Падл": "sport.padel",
  "Хоккей": "sport.hockey",
  "Другое": "sport.other",
  "Настольный теннис": "sport.tableTennis",
  "Падел": "sport.padelAlt",
  "Сквош": "sport.squash",
  "Бадминтон": "sport.badminton",
  "Единоборства": "sport.martialArts",
  "Фитнес": "sport.fitness",
};

const SURFACE_KEYS: Record<string, MessageKey> = {
  "Паркет": "surface.parquetShort",
  "Паркет (дерево)": "surface.parquet",
  "Спортивный ПВХ-линолеум": "surface.pvc",
  "Резиновое покрытие": "surface.rubber",
  "Модульное покрытие (полипропилен)": "surface.modular",
  "Искусственный газон": "surface.artificialTurf",
  "Натуральный газон": "surface.naturalGrass",
  "Хард (теннисный корт)": "surface.hard",
  "Теннисный грунт": "surface.clay",
  "Лёд": "surface.ice",
  "Песок (пляжный)": "surface.sand",
  "Татами / маты": "surface.tatami",
  "Ковролин": "surface.carpet",
  "Асфальт / бетон": "surface.asphalt",
  "Спортивный паркет": "surface.sportsParquet",
  "Терафлекс": "surface.taraflex",
  "Хард": "surface.hardShort",
  "Резина": "surface.rubberShort",
};

function lookup(map: Record<string, MessageKey>, value: string | null | undefined, t: TFunction = tr): string {
  if (!value) return "";
  const key = map[value];
  return key ? t(key) : value;
}

const EQUIPMENT_KEYS: Record<string, MessageKey> = {
  "LED-освещение": "equip.led",
  "Профессиональные мячи": "equip.balls",
  "Сетка / Ворота / Кольца": "equip.net",
  "Электронное табло": "equip.scoreboard",
  "Раздевалка с душем": "equip.lockerShower",
  "Манишки": "equip.bibs",
  "Акустическая система": "equip.audio",
  "Судейская вышка": "equip.umpire",
  "Прокат ракеток": "equip.rackets",
  "Кулер с водой": "equip.water",
};

/** Preset hall equipment (stored in Russian); custom items are shown as typed. */
export const equipmentLabel = (value: string | null | undefined, t?: TFunction) => lookup(EQUIPMENT_KEYS, value, t);

export const sportLabel = (value: string | null | undefined, t?: TFunction) => lookup(SPORT_KEYS, value, t);
export const surfaceLabel = (value: string | null | undefined, t?: TFunction) => lookup(SURFACE_KEYS, value, t);

// Cities are stored by their Russian name (lib/cities.ts, backend).
const CITY_KEYS: Record<string, MessageKey> = {
  "Астана": "city.astana",
  "Алматы": "city.almaty",
  "Шымкент": "city.shymkent",
  "Актобе": "city.aktobe",
  "Актау": "city.aktau",
  "Атырау": "city.atyrau",
  "Караганда": "city.karaganda",
  "Кокшетау": "city.kokshetau",
  "Конаев": "city.konaev",
  "Костанай": "city.kostanay",
  "Кызылорда": "city.kyzylorda",
  "Павлодар": "city.pavlodar",
  "Петропавловск": "city.petropavl",
  "Семей": "city.semey",
  "Талдыкорган": "city.taldykorgan",
  "Тараз": "city.taraz",
  "Туркестан": "city.turkistan",
  "Уральск": "city.oral",
  "Усть-Каменогорск": "city.oskemen",
  "Жезказган": "city.zhezkazgan",
  "Экибастуз": "city.ekibastuz",
  "Рудный": "city.rudny",
  "Темиртау": "city.temirtau",
  "Балхаш": "city.balkhash",
  "Жанаозен": "city.zhanaozen",
  "Кентау": "city.kentau",
  "Сатпаев": "city.satpayev",
  "Риддер": "city.ridder",
  "Степногорск": "city.stepnogorsk",
  "Щучинск": "city.shchuchinsk",
  "Аксу": "city.aksu",
  "Аркалык": "city.arkalyk",
  "Каскелен": "city.kaskelen",
  "Талгар": "city.talgar",
  "Есик": "city.yesik",
  "Косшы": "city.kosshy",
  "Сарань": "city.saran",
  "Шахтинск": "city.shakhtinsk",
  "Абай": "city.abay",
  "Аягоз": "city.ayagoz",
  "Лисаковск": "city.lisakovsk",
  "Житикара": "city.zhitikara",
  "Ушарал": "city.usharal",
  "Алтай": "city.altay",
  "Жаркент": "city.zharkent",
  "Зайсан": "city.zaysan",
};

// Arena category / venue type as stored on the arena.
const CATEGORY_KEYS: Record<string, MessageKey> = {
  "Спорткомплекс": "venue.categoryComplex",
  "Отдельный зал": "venue.single",
  "Открытая площадка": "venue.outdoor",
};

export const cityLabel = (value: string | null | undefined, t?: TFunction) => lookup(CITY_KEYS, value, t);
export const categoryLabel = (value: string | null | undefined, t?: TFunction) => lookup(CATEGORY_KEYS, value, t);

/** True if the city (by any of its names) matches a search query. */
export function cityMatches(city: string, query: string, t?: TFunction): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return city.toLowerCase().includes(q) || cityLabel(city, t).toLowerCase().includes(q);
}

// JS weekday index: 0 = Sunday … 6 = Saturday.
const WEEKDAY_KEYS: MessageKey[] = [
  "weekday.sun", "weekday.mon", "weekday.tue", "weekday.wed", "weekday.thu", "weekday.fri", "weekday.sat",
];
const WEEKDAY_SHORT_KEYS: MessageKey[] = [
  "weekdayShort.sun", "weekdayShort.mon", "weekdayShort.tue", "weekdayShort.wed",
  "weekdayShort.thu", "weekdayShort.fri", "weekdayShort.sat",
];
const MONTH_KEYS: MessageKey[] = [
  "month.jan", "month.feb", "month.mar", "month.apr", "month.may", "month.jun",
  "month.jul", "month.aug", "month.sep", "month.oct", "month.nov", "month.dec",
];
// Month as used after a day number: "14 ноября" / "November 14" / "14 қараша".
const MONTH_GEN_KEYS: MessageKey[] = [
  "monthGen.jan", "monthGen.feb", "monthGen.mar", "monthGen.apr", "monthGen.may", "monthGen.jun",
  "monthGen.jul", "monthGen.aug", "monthGen.sep", "monthGen.oct", "monthGen.nov", "monthGen.dec",
];

const MONTH_SHORT_KEYS: MessageKey[] = [
  "monthShort.jan", "monthShort.feb", "monthShort.mar", "monthShort.apr", "monthShort.may", "monthShort.jun",
  "monthShort.jul", "monthShort.aug", "monthShort.sep", "monthShort.oct", "monthShort.nov", "monthShort.dec",
];

export const monthShort = (month: number, t: TFunction = tr) => t(MONTH_SHORT_KEYS[month]);
export const weekdayName = (jsDay: number, t: TFunction = tr) => t(WEEKDAY_KEYS[((jsDay % 7) + 7) % 7]);
export const weekdayShort = (jsDay: number, t: TFunction = tr) => t(WEEKDAY_SHORT_KEYS[((jsDay % 7) + 7) % 7]);
export const monthName = (month: number, t: TFunction = tr) => t(MONTH_KEYS[month]);
export const monthGenitive = (month: number, t: TFunction = tr) => t(MONTH_GEN_KEYS[month]);

/** "14 ноября" / "November 14" / "14 қараша". */
export function dayMonth(d: Date, t: TFunction = tr): string {
  return t("date.dayMonth", { day: d.getDate(), month: monthGenitive(d.getMonth(), t) });
}

/** "14 ноября 2026" / "14 November 2026" / "2026 ж. 14 қараша". */
export function dayMonthYear(d: Date, t: TFunction = tr): string {
  return t("date.dayMonthYear", { day: d.getDate(), month: monthGenitive(d.getMonth(), t), year: d.getFullYear() });
}

/** "14:05" from a Date. */
export function timeHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Booking date as stored ("2026-11-04", or the demo sentinels "Сегодня" /
 * "Завтра") → "4 ноября" / "November 4" / "Сегодня" in the selected language.
 */
export function displayDate(value: string | null | undefined, t: TFunction = tr): string {
  if (!value) return "";
  if (value === "Сегодня") return t("date.today");
  if (value === "Завтра") return t("date.tomorrow");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayMonth(d, t);
}

/**
 * Arena working hours are stored as Russian text built by the business
 * profile ("08:00 - 23:00 (ежедневно)", "Круглосуточно (24/7)"). Recognised
 * strings are re-rendered in the selected language; free text is shown as-is.
 */
export function workingHoursLabel(raw: string | null | undefined, t: TFunction = tr): string {
  if (!raw) return "";
  const text = raw.toLowerCase();
  if (text.includes("24/7") || text.includes("круглосуточ")) return t("hours.allDay");
  const m = raw.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (!m) return raw;
  let mode: MessageKey | null = null;
  if (text.includes("ежедневн")) mode = "hours.daily";
  else if (text.includes("пн–пт") || text.includes("пн-пт") || text.includes("будн")) mode = "hours.weekdays";
  else if (text.includes("пн–сб") || text.includes("пн-сб")) mode = "hours.monSat";
  const range = `${m[1]} - ${m[2]}`;
  return mode ? t("hours.rangeWithMode", { range, mode: t(mode) }) : range;
}

const RU_MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Chat list time as stored ("15:42", "Вчера", "3 ноя") in the selected language. */
export function chatTimeLabel(value: string | null | undefined, t: TFunction = tr): string {
  if (!value) return "";
  if (value === "Вчера") return t("date.yesterday");
  if (value === "Сегодня") return t("date.today");
  const m = /^(\d{1,2})\s+([а-яё]+)\.?$/i.exec(value.trim());
  const month = m ? RU_MONTHS_SHORT.indexOf(m[2].toLowerCase().slice(0, 3)) : -1;
  return m && month >= 0 ? t("date.dayMonth", { day: m[1], month: monthShort(month, t) }) : value;
}
