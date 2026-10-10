// Fechas locales del salón (zona horaria IANA). Funciones puras, sin acceso al reloj.
import { formatLocalDateISO } from "@/infra/format/dates";

export function localDateStr(isoStr: string, tz: string): string {
  return formatLocalDateISO(new Date(isoStr), tz);
}

export function isSameLocalDay(left: string | null, right: string, tz: string): boolean {
  return !!left && localDateStr(left, tz) === right;
}
