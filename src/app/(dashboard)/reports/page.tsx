import { parseReportFilters } from "@/features/reports/schemas";
import { getOperationalReport } from "@/features/reports/use-cases/get-operational-report";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { ReportsView } from "./reports-view";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.REPORTS_VIEW)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para ver reportes.</p>
      </div>
    );
  }

  const params = await searchParams;
  const filters = parseReportFilters(params);
  const modules = {
    inventory: await isEffectiveSalonModuleEnabled(profile, "inventory"),
    retail: await isEffectiveSalonModuleEnabled(profile, "retail"),
    expenses: await isEffectiveSalonModuleEnabled(profile, "expenses"),
  };
  const report = await getOperationalReport({ salonId: profile.salon_id, filters, modules });

  return <ReportsView key={`${report.preset}:${report.from}:${report.to}`} {...report} />;
}
