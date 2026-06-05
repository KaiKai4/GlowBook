import { shouldBlockCalendar, type AppointmentStatus } from "./lifecycle";

export type CalendarView = "diaria" | "semanal" | "trabajador";

interface CalendarCountAppointment {
  status: AppointmentStatus;
  start_time: string | null;
}

export interface BusinessDayConfig {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

function dateFromISO(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(date: string, days: number): string {
  const value = dateFromISO(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toISODate(value);
}

export function getWeekDates(date: string): string[] {
  const value = dateFromISO(date);
  const day = value.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(value);
  monday.setUTCDate(value.getUTCDate() + diffToMonday);

  return Array.from({ length: 7 }, (_, index) => addCalendarDays(toISODate(monday), index));
}

export function businessDayFromISO(date: string): number {
  const jsDay = dateFromISO(date).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function getOpenBusinessDays(businessHours: BusinessDayConfig[]): Set<number> {
  if (businessHours.length === 0) return new Set([0, 1, 2, 3, 4, 5]);

  return new Set(
    businessHours
      .filter((hours) => hours.is_open && hours.open_time && hours.close_time)
      .map((hours) => hours.day_of_week)
  );
}

export function getVisibleWeekDates(date: string, businessHours: BusinessDayConfig[]): string[] {
  const weekDates = getWeekDates(date);
  const openBusinessDays = getOpenBusinessDays(businessHours);
  return weekDates.filter((weekDate) => openBusinessDays.has(businessDayFromISO(weekDate)));
}

export function getBusinessHourRange(
  businessHours: BusinessDayConfig[]
): { businessStart: number; businessEnd: number } {
  const openDays = businessHours.filter(
    (hours) => hours.is_open && hours.open_time && hours.close_time
  );

  if (openDays.length === 0) return { businessStart: 8, businessEnd: 21 };

  return {
    businessStart: Math.min(
      ...openDays.map((hours) => parseInt(hours.open_time!.slice(0, 2), 10))
    ),
    businessEnd: Math.max(
      ...openDays.map((hours) => {
        const [hour, minute] = hours.close_time!.split(":").map(Number);
        return minute > 0 ? hour + 1 : hour;
      })
    ),
  };
}

export function localCalendarDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return dateFromISO(date).toLocaleDateString("es-PA", { ...options, timeZone: "UTC" });
}

export function formatCalendarDateLabel(
  date: string,
  view: CalendarView,
  visibleWeekDates: string[],
  weekDates: string[]
): string {
  if (view === "semanal") {
    const displayDates = visibleWeekDates.length > 0 ? visibleWeekDates : weekDates;
    const start = displayDates[0];
    const end = displayDates[displayDates.length - 1];

    return `${formatDate(start, { day: "numeric" })} - ${formatDate(end, {
      day: "numeric",
    })} de ${formatDate(end, { month: "long" })}`;
  }

  return formatDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function countActiveCalendarAppointments(
  appointments: CalendarCountAppointment[],
  view: CalendarView,
  visibleWeekDates: string[],
  timezone: string
): number {
  return appointments.filter((appointment) => {
    if (!shouldBlockCalendar(appointment.status)) return false;
    if (view !== "semanal" || !appointment.start_time) return true;
    return visibleWeekDates.includes(localCalendarDate(appointment.start_time, timezone));
  }).length;
}

export function parseCalendarView(value: string | undefined): CalendarView {
  return value === "diaria" || value === "trabajador" || value === "semanal"
    ? value
    : "semanal";
}
