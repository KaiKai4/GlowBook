import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, getPermissions, PERMISSIONS } from "@/lib/auth/permissions";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, getUtcDayBoundaries } from "@/lib/utils/dates";
import {
  CalendarDays, Users, DollarSign, TrendingUp, ChevronRight, AlertCircle,
  BellRing, Phone, Scissors, Clock,
} from "lucide-react";

interface TopService { name: string; count: number; pct: number }
interface PendingAppt { id: string; customerName: string; phone: string | null; when: string }

async function getDashboardData(
  salonId: string,
  opts: { wantsReports: boolean; wantsConfirmations: boolean }
) {
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
  const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const [yearStr, monthStr] = localDateStr.split("-");
  let monthProbe = new Date(`${yearStr}-${monthStr}-01T12:00:00.000Z`);
  const probeLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(monthProbe);
  if (probeLocal !== `${yearStr}-${monthStr}-01`) {
    const delta = probeLocal > `${yearStr}-${monthStr}-01` ? -12 : 12;
    monthProbe = new Date(monthProbe.getTime() + delta * 60 * 60_000);
  }
  const { start: monthStart } = getUtcDayBoundaries(monthProbe, timezone);

  let metrics: {
    todayAppointments: number; monthRevenue: number;
    totalCustomers: number; completedThisMonth: number;
  } | null = null;
  let topServices: TopService[] = [];
  let pending: PendingAppt[] = [];

  if (opts.wantsReports) {
    const [todayAppts, monthAppts, totalCustomers, monthBooked] = await Promise.all([
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
      supabase
        .from("appointment_items")
        .select("service:services(name), appointment:appointments(status)")
        .eq("salon_id", salonId)
        .gte("start_time", monthStart.toISOString()),
    ]);

    const monthRevenue = (monthAppts.data ?? []).reduce((sum, a) => sum + Number(a.total_price), 0);
    metrics = {
      todayAppointments: todayAppts.count ?? 0,
      monthRevenue,
      totalCustomers: totalCustomers.count ?? 0,
      completedThisMonth: monthAppts.data?.length ?? 0,
    };

    // Most-used services this month (exclude cancelled / no-show).
    const counts = new Map<string, number>();
    for (const item of monthBooked.data ?? []) {
      const status = (item.appointment as { status: string } | null)?.status;
      if (status === "cancelled" || status === "no_show") continue;
      const name = (item.service as { name: string } | null)?.name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted[0]?.[1] ?? 0;
    topServices = sorted.map(([name, count]) => ({ name, count, pct: max ? (count / max) * 100 : 0 }));
  }

  if (opts.wantsConfirmations) {
    const { data: pendingData } = await supabase
      .from("appointments")
      .select("id, start_time, customer:customers(first_name, last_name, phone)")
      .eq("salon_id", salonId)
      .eq("status", "scheduled")
      .gte("start_time", now.toISOString())
      .order("start_time", { ascending: true })
      .limit(6);

    const fmt = new Intl.DateTimeFormat("es-PA", {
      timeZone: timezone, weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
    pending = (pendingData ?? []).map((a) => {
      const c = a.customer as { first_name: string; last_name: string; phone: string | null } | null;
      return {
        id: a.id,
        customerName: c ? `${c.first_name} ${c.last_name}` : "Cliente",
        phone: c?.phone ?? null,
        when: a.start_time ? fmt.format(new Date(a.start_time)) : "",
      };
    });
  }

  return { metrics, topServices, pending };
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

  const { metrics, topServices, pending } =
    canViewReports || canManageAppointments
      ? await getDashboardData(profile.salon_id, {
          wantsReports: canViewReports,
          wantsConfirmations: canManageAppointments,
        })
      : { metrics: null, topServices: [], pending: [] };

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

      {(canManageAppointments || canViewReports) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {canManageAppointments && <PendingConfirmations pending={pending} />}
          {canViewReports && <TopServices services={topServices} />}
        </div>
      )}

      {!metrics && quickLinks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="group flex items-center gap-4 rounded-xl border border-brand-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                <link.icon className="h-5 w-5 text-brand-600" />
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
            No tienes módulos asignados. Pide al administrador del salón que configure tu rol en la sección <strong>Colaboradores</strong>.
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
    violet: "bg-brand-50 text-brand-600",
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

function PendingConfirmations({ pending }: { pending: PendingAppt[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-amber-500" />
          Citas por confirmar
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">
            No hay citas pendientes de confirmar. 🎉
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-stone-400">
              Recuérdale a estos clientes que confirmen su cita:
            </p>
            <ul className="space-y-2.5">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">{p.customerName}</p>
                    <p className="flex items-center gap-1 text-xs text-stone-400">
                      <Clock className="h-3 w-3" /> {p.when}
                    </p>
                  </div>
                  {p.phone && (
                    <span className="flex items-center gap-1 text-xs font-medium text-brand-600 shrink-0">
                      <Phone className="h-3 w-3" /> {p.phone}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/recordatorios"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              Ir a recordatorios <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TopServices({ services }: { services: TopService[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-brand-500" />
          Servicios más usados
          <span className="ml-auto text-xs font-normal text-stone-400">Este mes</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">
            Aún no hay datos suficientes este mes.
          </p>
        ) : (
          <ul className="space-y-3">
            {services.map((s) => (
              <li key={s.name}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-stone-700">{s.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-stone-500">{s.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={cn("h-full rounded-full bg-brand-500")}
                    style={{ width: `${Math.max(s.pct, 4)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
