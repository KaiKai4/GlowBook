"use server";

import { getOperationalReport } from "@/features/reports/use-cases/get-operational-report";
import { parseReportFilters, type ReportQueryInput } from "@/features/reports/schemas";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import type { Result } from "@/lib/result";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";

export async function getReportAction(
  input: ReportQueryInput
): Promise<Result<OperationalReportViewModel>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.REPORTS_VIEW)) {
    return { ok: false, error: "No tienes permiso para ver reportes." };
  }

  try {
    const filters = parseReportFilters(input);
    const report = await getOperationalReport({ salonId: profile.salon_id, filters });
    return { ok: true, value: report };
  } catch {
    return { ok: false, error: "No se pudo cargar el reporte." };
  }
}
