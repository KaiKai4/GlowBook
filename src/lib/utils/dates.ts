export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function diffMinutes(end: Date, start: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

// Wall-clock day-of-week (0=Monday) and minutes-since-midnight for an instant,
// interpreted in the given IANA timezone. Business hours are stored as wall-clock
// times in the salon's timezone, so comparisons MUST use this — never Date.getHours(),
// which returns the server's local time (UTC on Vercel) and would be wrong.
export function getZonedTimeParts(
  date: Date,
  timeZone: string
): { dayOfWeek: number; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  let hour = parseInt(map.hour ?? "0", 10);
  if (hour === 24) hour = 0; // some runtimes emit "24" for midnight
  const minute = parseInt(map.minute ?? "0", 10);

  return {
    dayOfWeek: WEEKDAY_TO_INDEX[map.weekday] ?? 0,
    minutesOfDay: hour * 60 + minute,
  };
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatTimeTz(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("es-PA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("es-PA", { year: "numeric", month: "long", day: "numeric" });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(amount);
}

export function formatLocalDateISO(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  return `${map.year}-${map.month}-${map.day}`;
}

export function addDaysToDateISO(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Returns the UTC timestamps for the start (00:00:00.000) and end (23:59:59.999)
// of the calendar day that `date` falls on in the given IANA timezone.
// Uses the wall-clock parts of `date` in that timezone to compute the offset, so
// it is correct across DST transitions and never relies on the server's local time.
export function getUtcDayBoundaries(
  date: Date,
  timezone: string
): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const s = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);

  const secondsFromMidnight = (h === 24 ? 0 : h) * 3600 + m * 60 + s;
  const startMs =
    date.getTime() - secondsFromMidnight * 1_000 - date.getUTCMilliseconds();

  return {
    start: new Date(startMs),
    end: new Date(startMs + 24 * 60 * 60 * 1_000 - 1),
  };
}

// UTC instant range covering the local days [from, to] (YYYY-MM-DD) in the salon's
// timezone. Use for date-range queries against timestamptz columns so near-midnight
// rows land in the right day regardless of the server/connection timezone.
export function utcBounds(from: string, to: string, tz: string): { start: string; end: string } {
  const { start } = getUtcDayBoundaries(new Date(`${from}T12:00:00.000Z`), tz);
  const { end } = getUtcDayBoundaries(new Date(`${to}T12:00:00.000Z`), tz);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
