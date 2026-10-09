import { z } from "@/infra/validation/zod";

const REPORT_PRESETS = [
  "hoy",
  "semana",
  "mes",
  "mes_anterior",
  "30dias",
  "90dias",
] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];
export type SelectedReportPreset = ReportPreset | "custom";

const DEFAULT_REPORT_PRESET: ReportPreset = "mes";

const ReportDateSchema = z.string().date();

const ReportQuerySchema = z.object({
  preset: z.enum(REPORT_PRESETS).optional(),
  from: ReportDateSchema.optional(),
  to: ReportDateSchema.optional(),
});

export interface ReportFilters {
  preset: ReportPreset;
  from?: string;
  to?: string;
}

export type ReportQueryInput = z.input<typeof ReportQuerySchema>;

export function parseReportFilters(input: unknown): ReportFilters {
  const parsed = ReportQuerySchema.safeParse(input);
  if (!parsed.success) return { preset: DEFAULT_REPORT_PRESET };

  const preset = parsed.data.preset ?? DEFAULT_REPORT_PRESET;
  if (parsed.data.from && parsed.data.to && parsed.data.from <= parsed.data.to) {
    return { preset, from: parsed.data.from, to: parsed.data.to };
  }

  return { preset };
}
