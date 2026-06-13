import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import {
  getReportExportData,
  type ReportExportScope,
} from "@/features/reports/use-cases/get-report-export";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { captureError } from "@/lib/observability";
import { buildReportWorkbook } from "./workbook";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_PATTERN = /^\d{4}$/;

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!hasPermission(profile, PERMISSIONS.REPORTS_VIEW)) {
    return NextResponse.json({ error: "No tienes permiso para exportar reportes." }, { status: 403 });
  }

  // Generar el archivo recorre todo el historico: limite ajustado por usuario.
  const limited = assertActionRateLimit(profile.id, "reports-export", {
    max: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  // ?month=YYYY-MM exporta ese mes; ?year=YYYY ese año; sin parametro, todo.
  const searchParams = new URL(request.url).searchParams;
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  if (monthParam && !MONTH_PATTERN.test(monthParam)) {
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  }
  if (yearParam && !YEAR_PATTERN.test(yearParam)) {
    return NextResponse.json({ error: "Año inválido." }, { status: 400 });
  }
  const scope: ReportExportScope = monthParam
    ? { type: "month", monthKey: monthParam }
    : yearParam
      ? { type: "year", year: Number(yearParam) }
      : { type: "lifetime" };

  try {
    const modules = {
      inventory: await isEffectiveSalonModuleEnabled(profile, "inventory"),
      retail: await isEffectiveSalonModuleEnabled(profile, "retail"),
      expenses: await isEffectiveSalonModuleEnabled(profile, "expenses"),
    };
    const data = await getReportExportData(profile.salon_id, modules, scope);
    const workbook = buildReportWorkbook(data);
    const buffer = await workbook.xlsx.writeBuffer();

    const fileTag =
      monthParam ?? yearParam ?? `historico-${new Date().toISOString().slice(0, 10)}`;
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="glowbook-reportes-${fileTag}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    captureError(error, { module: "reports", action: "export" });
    return NextResponse.json({ error: "No se pudo generar el archivo." }, { status: 500 });
  }
}
