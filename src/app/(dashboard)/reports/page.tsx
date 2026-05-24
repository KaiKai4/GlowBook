import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { utcBounds } from "@/lib/utils/dates";
import { ReportsView } from "./reports-view";

type Preset = "hoy" | "semana" | "mes" | "mes_anterior" | "30dias" | "90dias";

function localStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date);
}

function getPresetRange(preset: Preset, tz: string): { from: string; to: string } {
  const now = new Date();
  const today = localStr(now, tz);

  switch (preset) {
    case "hoy":
      return { from: today, to: today };

    case "semana": {
      const dow = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
      const offset = ({ Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 } as Record<string, number>)[dow] ?? 0;
      const mon = new Date(now.getTime() - offset * 86_400_000);
      const sun = new Date(mon.getTime() + 6 * 86_400_000);
      return { from: localStr(mon, tz), to: localStr(sun, tz) };
    }

    case "mes": {
      const [y, m] = today.split("-");
      return { from: `${y}-${m}-01`, to: today };
    }

    case "mes_anterior": {
      const d = new Date(now);
      d.setUTCDate(1);
      d.setUTCDate(0);
      const last = localStr(d, tz);
      const [y, m] = last.split("-");
      return { from: `${y}-${m}-01`, to: last };
    }

    case "30dias": {
      const d = new Date(now.getTime() - 29 * 86_400_000);
      return { from: localStr(d, tz), to: today };
    }

    case "90dias": {
      const d = new Date(now.getTime() - 89 * 86_400_000);
      return { from: localStr(d, tz), to: today };
    }
  }
}

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
  const supabase = await createSupabaseServerClient();

  const { data: salonRow } = await supabase
    .from("salons").select("timezone").eq("id", profile.salon_id).single();
  const tz = salonRow?.timezone ?? "America/Panama";

  const preset = (params.preset ?? "mes") as Preset;
  const { from, to } =
    params.from && params.to
      ? { from: params.from, to: params.to }
      : getPresetRange(preset, tz);

  const { start, end } = utcBounds(from, to, tz);

  // ── Fetch ──────────────────────────────────────────────────────
  const [apptsRes, custRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, total_price")
      .eq("salon_id", profile.salon_id)
      .gte("start_time", start)
      .lte("start_time", end),

    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", profile.salon_id)
      .eq("is_temporary", false)
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

  const appts = apptsRes.data ?? [];
  const completedIds = appts.filter((a) => a.status === "completed").map((a) => a.id);

  type ItemRow = {
    appointment_id: string;
    price: number;
    service: { id: string; name: string } | null;
    employee: { id: string; first_name: string; last_name: string } | null;
  };

  let items: ItemRow[] = [];
  if (completedIds.length > 0) {
    const { data } = await supabase
      .from("appointment_items")
      .select("appointment_id, price, service:services(id, name), employee:employees(id, first_name, last_name)")
      .in("appointment_id", completedIds);
    items = (data ?? []) as unknown as ItemRow[];
  }

  // ── Aggregate ──────────────────────────────────────────────────
  const completed = appts.filter((a) => a.status === "completed");
  const revenue = completed.reduce((s, a) => s + Number(a.total_price ?? 0), 0);
  const avgTicket = completed.length > 0 ? revenue / completed.length : 0;
  const noShowCount = appts.filter((a) => a.status === "no_show").length;
  const noShowRate = appts.length > 0 ? (noShowCount / appts.length) * 100 : 0;

  // Status breakdown
  const statusMap: Record<string, number> = {};
  for (const a of appts) statusMap[a.status] = (statusMap[a.status] ?? 0) + 1;
  const STATUS_ORDER = ["completed", "confirmed", "scheduled", "cancelled", "no_show"];
  const statusBreakdown = STATUS_ORDER
    .filter((s) => statusMap[s])
    .map((s) => ({ status: s, count: statusMap[s], pct: (statusMap[s] / appts.length) * 100 }));

  // By employee
  const empMap: Record<string, { name: string; apptIds: Set<string>; revenue: number }> = {};
  for (const item of items) {
    if (!item.employee) continue;
    const key = item.employee.id;
    empMap[key] ??= { name: `${item.employee.first_name} ${item.employee.last_name}`, apptIds: new Set(), revenue: 0 };
    empMap[key].apptIds.add(item.appointment_id);
    empMap[key].revenue += Number(item.price ?? 0);
  }
  const empList = Object.values(empMap)
    .map((e) => ({ name: e.name, count: e.apptIds.size, revenue: e.revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const maxEmpRev = empList[0]?.revenue ?? 0;
  const byEmployee = empList.map((e) => ({
    ...e, pct: maxEmpRev > 0 ? (e.revenue / maxEmpRev) * 100 : 0,
  }));

  // By service
  const svcMap: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const item of items) {
    if (!item.service) continue;
    const key = item.service.id;
    svcMap[key] ??= { name: item.service.name, count: 0, revenue: 0 };
    svcMap[key].count += 1;
    svcMap[key].revenue += Number(item.price ?? 0);
  }
  const svcList = Object.values(svcMap).sort((a, b) => b.count - a.count);
  const maxSvcCount = svcList[0]?.count ?? 0;
  const byService = svcList.map((s) => ({
    ...s, pct: maxSvcCount > 0 ? (s.count / maxSvcCount) * 100 : 0,
  }));

  return (
    <ReportsView
      from={from}
      to={to}
      preset={params.from && params.to ? "custom" : preset}
      revenue={revenue}
      completedCount={completed.length}
      totalCount={appts.length}
      avgTicket={avgTicket}
      noShowRate={noShowRate}
      statusBreakdown={statusBreakdown}
      byEmployee={byEmployee}
      byService={byService}
      newCustomers={custRes.count ?? 0}
    />
  );
}
