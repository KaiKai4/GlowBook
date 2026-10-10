import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subYears,
} from "date-fns";

export type DatePickerMode = "days" | "months" | "years";

export function parseDateValue(value?: string): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

export function toDateValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];

  // Rellena hasta 6 semanas (42 días) desde el inicio de la rejilla.
  for (let date = start; date <= end || days.length < 42; date = addDays(date, 1)) {
    days.push(date);
  }

  return days;
}

export function getYearBlock(year: number): number[] {
  const start = Math.floor(year / 12) * 12;
  return Array.from({ length: 12 }, (_, index) => start + index);
}

export function shiftCalendarView(
  date: Date,
  mode: DatePickerMode,
  direction: -1 | 1
): Date {
  if (mode === "days") {
    return direction < 0 ? subMonths(date, 1) : addMonths(date, 1);
  }

  if (mode === "months") {
    return direction < 0 ? subYears(date, 1) : addYears(date, 1);
  }

  return direction < 0 ? subYears(date, 12) : addYears(date, 12);
}

