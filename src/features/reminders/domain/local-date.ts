// Fechas locales del salón (zona horaria IANA). Funciones puras, sin acceso al reloj.

export function localDateStr(isoStr: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(isoStr));
}

export function isSameLocalDay(left: string | null, right: string, tz: string): boolean {
  return !!left && localDateStr(left, tz) === right;
}
