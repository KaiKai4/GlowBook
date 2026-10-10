import { getOperationalReport, parseReportFilters } from "@/features/reports";
import { isEffectiveSalonModuleEnabled, salonModuleScopeFromProfile } from "@/features/billing";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
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
    inventory: await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "inventory"),
    retail: await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "retail"),
    expenses: await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "expenses"),
  };
  const report = await getOperationalReport({ salonId: profile.salon_id, filters, modules, year });

  return (
    <ReportsView
      key={`${report.preset}:${report.from}:${report.to}:${report.selectedYear}`}
      {...report}
    />
  );
}
