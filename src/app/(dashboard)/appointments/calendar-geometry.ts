import { formatLocalDateISO, getZonedTimeParts } from "@/infra/format/dates";
import type { CalendarAppointment } from "@/features/appointments/view-models";

export const DEFAULT_START = 8;
export const DEFAULT_END = 21;
export const HOUR_HEIGHT = 72;
export const PX_PER_MIN = HOUR_HEIGHT / 60;
export const TIME_LABEL_TOP_SPACE = 14;
export const TIME_LABEL_EDGE_SPACE = 18;

// 24h hour → { num, period } in 12h format (13 → 1 pm, 20 → 8 pm, 0 → 12 am).
export function hourLabel(h24: number): { num: number; period: string } {
  const hour = ((h24 % 24) + 24) % 24;
  const num = hour % 12 === 0 ? 12 : hour % 12;
  return { num, period: hour < 12 ? "am" : "pm" };
}

function getLocalHM(isoStr: string, tz: string): { h: number; m: number } {
  const { minutesOfDay } = getZonedTimeParts(new Date(isoStr), tz);
  return { h: Math.floor(minutesOfDay / 60), m: minutesOfDay % 60 };
}

// Effective grid range: starts at the salon's open hour but always widens to keep
// any out-of-hours appointments visible (e.g. ones booked before hours changed).
export function computeRange(
  appts: CalendarAppointment[],
  tz: string,
  businessStart: number,
  businessEnd: number
): { calStart: number; calEnd: number } {
  let calStart = businessStart;
  let calEnd = businessEnd;
  for (const a of appts) {
    if (!a.start_time) continue;
    const s = getLocalHM(a.start_time, tz);
    calStart = Math.min(calStart, s.h);
    if (a.end_time) {
      const e = getLocalHM(a.end_time, tz);
      calEnd = Math.max(calEnd, e.m > 0 ? e.h + 1 : e.h);
    } else {
      calEnd = Math.max(calEnd, s.h + 1);
    }
  }
  calStart = Math.max(0, calStart);
  calEnd = Math.min(24, calEnd);
  if (calEnd <= calStart) calEnd = Math.min(24, calStart + 1);
  return { calStart, calEnd };
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMinutesFromCalStart(isoStr: string, tz: string, calStart: number): number {
  const { h, m } = getLocalHM(isoStr, tz);
  return (h - calStart) * 60 + m;
}

export function getLocalDate(isoStr: string, tz: string): string {
  return formatLocalDateISO(new Date(isoStr), tz);
}

export interface PositionedAppointment {
  appt: CalendarAppointment;
  col: number;
  startMin: number;
  endMin: number;
}

// Greedy column packing: each appointment takes the first column whose previous
// booking has already ended, so overlapping appointments sit side by side.
export function assignColumns(
  appts: CalendarAppointment[],
  tz: string,
  calStart: number
): { items: PositionedAppointment[]; totalCols: number } {
  const result: PositionedAppointment[] = [];
  const colEnds: number[] = [];
  for (const appt of appts) {
    if (!appt.start_time) continue;
    const startMin = getMinutesFromCalStart(appt.start_time, tz, calStart);
    const endMin = appt.end_time ? getMinutesFromCalStart(appt.end_time, tz, calStart) : startMin + 30;
    let col = colEnds.findIndex((e) => e <= startMin);
    if (col === -1) { col = colEnds.length; colEnds.push(endMin); }
    else colEnds[col] = endMin;
    result.push({ appt, col, startMin, endMin });
  }
  return { items: result, totalCols: Math.max(colEnds.length, 1) };
}
