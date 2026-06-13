import type { ReportQueryInput } from "@/features/reports/schemas";

export interface ReportsHrefInput extends ReportQueryInput {
  /** Año del acumulado anual; el page lo valida contra los años disponibles. */
  year?: number;
}

export function buildReportsHref(input: ReportsHrefInput): string {
  const params = new URLSearchParams();

  if (input.from && input.to) {
    params.set("from", input.from);
    params.set("to", input.to);
  } else if (input.preset) {
    params.set("preset", input.preset);
  }

  if (input.year) params.set("year", String(input.year));

  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}
