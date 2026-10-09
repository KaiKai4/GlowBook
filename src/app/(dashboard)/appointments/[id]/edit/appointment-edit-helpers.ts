/** Hora (HH:mm, 24 h) de una fecha en la zona horaria indicada. Medianoche se expresa como 00:00. */
export function localTime(date: Date, timeZone: string): string {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return value === "24:00" ? "00:00" : value;
}

/** Clave estable de fila de servicio para React (única por montaje). */
export function rowKey(index: number): string {
  return `edit-${index}-${crypto.randomUUID()}`;
}
