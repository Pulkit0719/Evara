export const today = () => new Date().toISOString().slice(0, 10);

export function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00.000Z`),
  );
}

export function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00.000Z`),
  );
}

export function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(value);
}

export function daysInCalendarMonth(value: Date) {
  const year = value.getFullYear();
  const month = value.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= days ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
  });
}
