import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, getPermissions, PERMISSIONS } from "@/lib/auth/permissions";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, getUtcDayBoundaries } from "@/lib/utils/dates";
import { CalendarDays, Users, DollarSign, TrendingUp, ChevronRight, AlertCircle } from "lucide-react";

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
  const visibleNav = getVisibleNavItems(getPermissions(profile), profile.is_owner);

  // Collaborators with access to a single module skip the home page and land
  // directly on it (e.g. a view-only stylist goes straight to their calendar).
  if (!profile.is_owner && visibleNav.length === 1) {
    redirect(visibleNav[0].href);
  }

  const canViewReports = hasPermission(profile, PERMISSIONS.REPORTS_VIEW);
  const canManageAppointments = hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE);
  const canViewAppointments = canManageAppointments || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW);
  const canManageCustomers = hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE);

  const metrics = canViewReports ? await getReportMetrics(profile.salon_id) : null;

  const quickLinks = [
    canViewAppointments && {
      href: "/appointments",
      icon: CalendarDays,
      label: "Citas",
      description: canManageAppointments ? "Ver y gestionar el calendario de citas" : "Ver tu calendario de citas",
    },
    canManageCustomers && { href: "/customers", icon: Users, label: "Clientes", description: "Consultar y registrar clientes" },
  ].filter(Boolean) as { href: string; icon: React.ComponentType<{ className?: string }>; label: string; description: string }[];

  const hasAnyAccess = visibleNav.length > 0;

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

      {!metrics && quickLinks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="group flex items-center gap-4 rounded-xl border border-violet-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                <link.icon className="h-5 w-5 text-violet-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-900">{link.label}</p>
                <p className="text-xs text-stone-400 truncate">{link.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-stone-300 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

      {!hasAnyAccess && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 max-w-md">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            No tienes módulos asignados. Pide al administrador del salón que configure tu rol en la sección <strong>Empleados</strong>.
          </p>
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
