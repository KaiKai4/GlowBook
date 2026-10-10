// Formatos en español (es-PA) con nombre propio. Es el único sitio donde se
// construyen formateadores de fecha y hora para la interfaz: componentes, casos de
// uso y dominio llaman a estas funciones en lugar de Intl o toLocale* directamente.

const LOCALE = "es-PA";

export type MonthStyle = "short" | "long";

/** Formato libre en es-PA; para etiquetas cuyo formato no tiene nombre propio. */
export function formatEsDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, options).format(date);
}

/** Día de la semana, día y mes ("lunes, 12 oct"), con año opcional. */
export function formatWeekdayDayMonth(
  date: Date,
  options: { weekday: "long" | "short"; month: MonthStyle; year?: boolean; timeZone?: string }
): string {
  return formatEsDate(date, {
    weekday: options.weekday,
    day: "numeric",
    month: options.month,
    year: options.year ? "numeric" : undefined,
    timeZone: options.timeZone,
  });
}

/** Día y mes ("12 oct"). */
export function formatDayMonth(
  date: Date,
  options: { month: MonthStyle; timeZone?: string } = { month: "short" }
): string {
  return formatEsDate(date, { day: "numeric", month: options.month, timeZone: options.timeZone });
}

/** Día de la semana abreviado ("lun"). */
export function formatWeekdayShort(date: Date, timeZone?: string): string {
  return formatEsDate(date, { weekday: "short", timeZone });
}

/** Mes abreviado sin punto final ("oct"). */
export function formatMonthShort(date: Date, timeZone?: string): string {
  return formatEsDate(date, { month: "short", timeZone }).replace(".", "");
}

/** Hora en formato de 12 horas ("3 p. m."). */
export function formatHour12(date: Date, timeZone?: string): string {
  return formatEsDate(date, { hour: "numeric", hour12: true, timeZone });
}

/** Hora y minutos en 24 horas con dos dígitos ("09:30 a. m." según locale; ver formatClockTime). */
export function formatClockTime(date: Date, timeZone?: string): string {
  return formatEsDate(date, { hour: "2-digit", minute: "2-digit", timeZone });
}

/** Día de la semana, día, mes y hora ("lun, 12 oct, 09:30 a. m."). */
export function formatWeekdayDateTime(date: Date, timeZone: string): string {
  return formatEsDate(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** Fecha numérica ("10/12/2026"). */
export function formatNumericDate(date: Date): string {
  return date.toLocaleDateString(LOCALE);
}

/** Fecha y hora numéricas ("10/12/2026, 9:30:00 a. m."). */
export function formatNumericDateTime(date: Date): string {
  return date.toLocaleString(LOCALE);
}

/** Fecha larga con hora corta ("12 de octubre de 2026 a las 9:30 a. m."). */
export function formatLongDateTime(date: Date, timeZone: string): string {
  return formatEsDate(date, { dateStyle: "long", timeStyle: "short", timeZone });
}
