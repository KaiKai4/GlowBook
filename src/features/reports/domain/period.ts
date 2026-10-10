import { formatLocalDateISO, getZonedTimeParts } from "@/infra/format/dates";
import type { ReportPreset } from "../schemas";

/** Días hacia atrás que cubre la ventana de 30 días (incluye hoy). */
const LAST_30_DAYS_OFFSET = 29;
/** Días hacia atrás que cubre la ventana de 90 días (incluye hoy). */
const LAST_90_DAYS_OFFSET = 89;

const DAY_MS = 86_400_000;

export interface ReportDateRange {
  from: string;
  to: string;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Año calendario local (en la zona del salón) de una fecha dada. */
export function localYear(date: Date, timezone: string): number {
  return Number(formatLocalDateISO(date, timezone).slice(0, 4));
}

/**
 * Rango de un año calendario: 1 de enero a 31 de diciembre. Es lo que hace que
 * el acumulado "se reinicie" cada 1 de enero — el año nuevo arranca vacío sin
 * borrar nada, solo filtrando por fechas.
 */
export function getYearRange(year: number): ReportDateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * Años con datos disponibles para consultar: desde el año de creación del
 * salón (o el más antiguo con movimientos) hasta el año en curso, del más
 * reciente al más antiguo.
 */
export function availableReportYears(earliestYear: number, currentYear: number): number[] {
  const first = Math.min(earliestYear, currentYear);
  const years: number[] = [];
  for (let year = currentYear; year >= first; year--) years.push(year);
  return years;
}

function previousMonthRange(today: string): ReportDateRange {
  const [yearText, monthText] = today.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
  const monthPart = pad(previousMonth);

  return {
    from: `${previousYear}-${monthPart}-01`,
    to: `${previousYear}-${monthPart}-${pad(lastDay)}`,
  };
}

interface PresetContext {
  now: Date;
  timezone: string;
  /** Hoy en la zona del salón (YYYY-MM-DD). */
  today: string;
}

/** Rango de cada preset. Tabla en lugar de switch: añadir un preset es una entrada. */
const PRESETS: Record<ReportPreset, (context: PresetContext) => ReportDateRange> = {
  hoy: ({ today }) => ({ from: today, to: today }),

  semana: ({ now, timezone }) => {
    const offset = getZonedTimeParts(now, timezone).dayOfWeek;
    const monday = new Date(now.getTime() - offset * DAY_MS);
    const sunday = new Date(monday.getTime() + 6 * DAY_MS);

    return {
      from: formatLocalDateISO(monday, timezone),
      to: formatLocalDateISO(sunday, timezone),
    };
  },

  mes: ({ today }) => {
    const [year, month] = today.split("-");
    return { from: `${year}-${month}-01`, to: today };
  },

  mes_anterior: ({ today }) => previousMonthRange(today),

  "30dias": ({ now, timezone, today }) => {
    const fromDate = new Date(now.getTime() - LAST_30_DAYS_OFFSET * DAY_MS);
    return { from: formatLocalDateISO(fromDate, timezone), to: today };
  },

  "90dias": ({ now, timezone, today }) => {
    const fromDate = new Date(now.getTime() - LAST_90_DAYS_OFFSET * DAY_MS);
    return { from: formatLocalDateISO(fromDate, timezone), to: today };
  },
};

export function getReportPresetRange(
  preset: ReportPreset,
  timezone: string,
  now = new Date()
): ReportDateRange {
  const today = formatLocalDateISO(now, timezone);
  return PRESETS[preset]({ now, timezone, today });
}

/** Último día (YYYY-MM-DD) de un mes dado como YYYY-MM. */
export function lastDayOfMonth(monthKey: string): string {
  const [year = NaN, month = NaN] = monthKey.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}
