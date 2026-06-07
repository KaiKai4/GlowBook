import type { ReportQueryInput } from "@/features/reports/schemas";

export function buildReportsHref(input: ReportQueryInput): string {
  const params = new URLSearchParams();

  if (input.from && input.to) {
    params.set("from", input.from);
    params.set("to", input.to);
  } else if (input.preset) {
    params.set("preset", input.preset);
  }

  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}
