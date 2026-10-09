// Tabs of the appointment summary list. Every lifecycle status must belong to at
// least one tab, otherwise those appointments are invisible in the list.
export type SummaryFilter = "upcoming" | "completed" | "cancelled" | "no_show";

export const SUMMARY_FILTERS: ReadonlyArray<{ value: SummaryFilter; label: string }> = [
  { value: "upcoming", label: "Citas próximas" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "no_show", label: "No asistió" },
];

export function matchesSummaryFilter(status: string, filter: SummaryFilter): boolean {
  if (filter === "upcoming") return status === "scheduled" || status === "confirmed";
  return status === filter;
}
