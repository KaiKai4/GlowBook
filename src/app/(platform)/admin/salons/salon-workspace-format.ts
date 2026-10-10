export const STATUS_LABELS: Record<string, string> = {
  trialing: "En trial",
  active: "Activo",
  past_due: "Moroso",
  paused: "Pausado",
  canceled: "Cancelado",
};

/** Fecha corta en español ("12 oct 2026") desde una fecha ISO sin hora. */
export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}
