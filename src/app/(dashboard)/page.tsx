import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils/dates";
import { CalendarDays, Users, DollarSign, TrendingUp } from "lucide-react";

async function getReportMetrics(salonId: string) {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayAppts, monthAppts, totalCustomers] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status", { count: "exact" })
      .eq("salon_id", salonId)
      .gte("start_time", new Date(today.setHours(0, 0, 0, 0)).toISOString())
      .lte("start_time", new Date(today.setHours(23, 59, 59, 999)).toISOString()),

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
