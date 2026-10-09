import { parseReportFilters } from "@/features/reports/schemas";
import { getOperationalReport } from "@/features/reports/use-cases/get-operational-report";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { requireProfile } from "@/infra/auth/session";
import { ReportsView } from "./reports-view";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string; year?: string }>;
}) {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.REPORTS_VIEW)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para ver reportes.</p>
      </div>
    );
  }

  const params = await searchParams;
  const filters = parseReportFilters(params);
  // Año del acumulado: validado contra los años disponibles en el use-case.
  const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : undefined;
  const modules = {
    inventory: await isEffectiveSalonModuleEnabled(profile, "inventory"),
    retail: await isEffectiveSalonModuleEnabled(profile, "retail"),
    expenses: await isEffectiveSalonModuleEnabled(profile, "expenses"),
  };
  const report = await getOperationalReport({ salonId: profile.salon_id, filters, modules, year });

  return (
    <ReportsView
      key={`${report.preset}:${report.from}:${report.to}:${report.selectedYear}`}
      {...report}
    />
  );
}
