export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}
