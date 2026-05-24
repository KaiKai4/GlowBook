import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, getUtcDayBoundaries } from "@/lib/utils/dates";
import { CalendarDays, Users, DollarSign, TrendingUp } from "lucide-react";

async function getReportMetrics(salonId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: salonData } = await supabase
    .from("salons")
    .select("timezone")
    .eq("id", salonId)
    .single();

  const timezone = salonData?.timezone ?? "UTC";
  const now = new Date();

  // Day boundaries in the salon's local timezone (not server/UTC time)
  const { start: todayStart, end: todayEnd } = getUtcDayBoundaries(now, timezone);

  // First day of the current month in the salon's timezone.
  // Strategy: use noon UTC on the local 1st and adjust if we land on the wrong day.
  const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const [yearStr, monthStr] = localDateStr.split("-");
  let monthProbe = new Date(`${yearStr}-${monthStr}-01T12:00:00.000Z`);
  const probeLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(monthProbe);
  if (probeLocal !== `${yearStr}-${monthStr}-01`) {
    const delta = probeLocal > `${yearStr}-${monthStr}-01` ? -12 : 12;
    monthProbe = new Date(monthProbe.getTime() + delta * 60 * 60_000);
  }
  const { start: monthStart } = getUtcDayBoundaries(monthProbe, timezone);

  const [todayAppts, monthAppts, totalCustomers] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status", { count: "exact" })
      .eq("salon_id", salonId)
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", todayEnd.toISOString()),

    supabase
      .from("appointments")
      .select("total_price, status")
      .eq("salon_id", salonId)
      .eq("status", "completed")
      .gte("start_time", monthStart.toISOString()),

    supabase
      .from("customers")
      .select("id", { count: "exact" })
      .eq("salon_id", salonId)
      .eq("is_active", true),
  ]);

  const monthRevenue = (monthAppts.data ?? []).reduce((sum, a) => sum + Number(a.total_price), 0);

  return {
    todayAppointments: todayAppts.count ?? 0,
    monthRevenue,
    totalCustomers: totalCustomers.count ?? 0,
    completedThisMonth: monthAppts.data?.length ?? 0,
  };
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const canViewReports = hasPermission(profile, PERMISSIONS.REPORTS_VIEW);

  const metrics = canViewReports ? await getReportMetrics(profile.salon_id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Bienvenido, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          {formatDate(new Date())}
        </p>
      </div>

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Citas hoy"
            value={String(metrics.todayAppointments)}
            icon={CalendarDays}
            color="blue"
          />
          <MetricCard
            title="Ingresos del mes"
            value={formatCurrency(metrics.monthRevenue)}
            icon={DollarSign}
            color="emerald"
          />
          <MetricCard
            title="Clientes activos"
            value={String(metrics.totalCustomers)}
            icon={Users}
            color="violet"
          />
          <MetricCard
            title="Completadas este mes"
            value={String(metrics.completedThisMonth)}
            icon={TrendingUp}
            color="rose"
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "emerald" | "violet" | "rose";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
          </div>
          <div className={`rounded-lg p-2 ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
