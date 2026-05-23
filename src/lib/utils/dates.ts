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

export function getDayOfWeek(date: Date): number {
  // 0=Monday ... 6=Sunday (blueprint convention)
  const day = date.getDay(); // 0=Sunday, 1=Monday...
  return day === 0 ? 6 : day - 1;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
