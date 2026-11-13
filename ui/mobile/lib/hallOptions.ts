import { tr } from "@/lib/i18n";

// Reference lists for the business "add / edit hall" form. Surface values are
// stored in Russian; translate them for display with surfaceLabel().

export const SURFACE_TYPES = [
  "Паркет (дерево)",
  "Спортивный ПВХ-линолеум",
  "Резиновое покрытие",
  "Модульное покрытие (полипропилен)",
  "Искусственный газон",
  "Натуральный газон",
  "Хард (теннисный корт)",
  "Теннисный грунт",
  "Лёд",
  "Песок (пляжный)",
  "Татами / маты",
  "Ковролин",
  "Асфальт / бетон",
];

// Max number of people on the hall at once.
export const CAPACITY_OPTIONS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 30, 40, 50];

// Hall length / width in meters, up to 1000 m (backend accepts 0..1000).
// Finer steps for typical halls, coarser for big outdoor fields:
// 10..100 step 5, 110..200 step 10, 250..1000 step 50 (45 options).
const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const SIZE_OPTIONS = [...range(10, 100, 5), ...range(110, 200, 10), ...range(250, 1000, 50)];

export const MAX_HALL_PHOTOS = 5;

export function capacityLabel(people: number): string {
  return people > 0 ? tr("hallOptions.capacity", { n: people }) : "";
}

export function sizeLabel(lengthM: number, widthM: number): string {
  return lengthM > 0 && widthM > 0 ? tr("hallOptions.size", { l: lengthM, w: widthM }) : "";
}
