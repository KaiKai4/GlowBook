import { getZonedTimeParts } from "@/infra/format/dates";



/** Hora (HH:mm, 24 h) de una fecha en la zona horaria indicada. Medianoche se expresa como 00:00. */
export function localTime(date: Date, timeZone: string): string {
  const { minutesOfDay } = getZonedTimeParts(date, timeZone);
  const hours = String(Math.floor(minutesOfDay / 60)).padStart(2, "0");
  const minutes = String(minutesOfDay % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Clave estable de fila de servicio para React (única por montaje). */
export function rowKey(index: number): string {
  return `edit-${index}-${crypto.randomUUID()}`;
}
