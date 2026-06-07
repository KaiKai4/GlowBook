"use server";

import {
  getOperationalReportPeriod,
  type OperationalReportPeriodViewModel,
} from "@/features/reports/use-cases/get-operational-report";
import { parseReportFilters, type ReportQueryInput } from "@/features/reports/schemas";
import { hasPermission, hasSalonFeature, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import type { Result } from "@/lib/result";

export async function getReportAction(
  input: ReportQueryInput
): Promise<Result<OperationalReportPeriodViewModel>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.REPORTS_VIEW)) {
    return { ok: false, error: "No tienes permiso para ver reportes." };
  }

  try {
    const filters = parseReportFilters(input);
    const report = await getOperationalReportPeriod({
      salonId: profile.salon_id,
      filters,
      modules: {
        inventory: hasSalonFeature(profile, "inventory"),
        retail: hasSalonFeature(profile, "retail"),
        expenses: hasSalonFeature(profile, "expenses"),
      },
    });
    return { ok: true, value: report };
  } catch {
    return { ok: false, error: "No se pudo cargar el reporte." };
  }
}
