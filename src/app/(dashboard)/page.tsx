import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getDisabledSalonFeatures, getPermissions, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { isSalonFeatureDisabled } from "@/features/salon/domain/salon-features";
import {
  getDashboardOverview,
  type PendingAppointmentConfirmation,
  type TopService,
} from "@/features/dashboard/use-cases/get-dashboard-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/dates";
import { MonthlyAppointmentsChart } from "./monthly-appointments-chart";
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  ChevronRight,
  Clock,
  DollarSign,
  ReceiptText,
  Scissors,
  TrendingUp,
  Users,
} from "lucide-react";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const disabledFeatures = getDisabledSalonFeatures(profile);
  const visibleNav = getVisibleNavItems(
    getPermissions(profile),
    profile.is_owner,
    disabledFeatures
  );

  if (!profile.is_owner && visibleNav.length === 1) {
    redirect(visibleNav[0].href);
  }

  const canViewReports = hasPermission(profile, PERMISSIONS.REPORTS_VIEW);
  const canManageAppointments = hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE);
  const canViewAppointments = canManageAppointments || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW);
  const canManageCustomers = hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE);
  const hasExpensesFeature = !isSalonFeatureDisabled(disabledFeatures, "expenses");
  const hasRetailFeature = !isSalonFeatureDisabled(disabledFeatures, "retail");

  const { metrics, topServices, monthlyCompletedAppointments, pending } =
    canViewReports || canManageAppointments
      ? await getDashboardOverview({
          salonId: profile.salon_id,
          wantsReports: canViewReports,
          wantsConfirmations: canManageAppointments,
        })
      : { metrics: null, topServices: [], monthlyCompletedAppointments: [], pending: [] };

  const quickLinks = [
    canViewAppointments && {
      href: "/appointments",
      icon: CalendarDays,
      label: "Citas",
      description: canManageAppointments ? "Ver y gestionar el calendario de citas" : "Ver tu calendario de citas",
    },
    canManageCustomers && {
      href: "/customers",
      icon: Users,
      label: "Clientes",
      description: "Consultar y registrar clientes",
    },
  ].filter(Boolean) as {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
  }[];

  const hasAnyAccess = visibleNav.length > 0;
  const profitMetric = metrics
    ? metrics.appointmentRevenue + (hasRetailFeature ? metrics.retailRevenue : 0) - (hasExpensesFeature ? metrics.monthExpenses : 0)
    : 0;
  const monthRevenueMetric = metrics ? metrics.appointmentRevenue + (hasRetailFeature ? metrics.retailRevenue : 0) : 0;
  const showProfitMetric = Boolean(metrics && (hasRetailFeature || hasExpensesFeature));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Bienvenido</h1>
        <p className="mt-1 text-sm text-neutral-500">{formatDate(new Date())}</p>
      </div>

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hasExpensesFeature && (
            <MetricCard title="Gastos del mes" value={formatCurrency(metrics.monthExpenses)} icon={ReceiptText} color="red" />
          )}
          <MetricCard title="Ingresos del mes" value={formatCurrency(monthRevenueMetric)} icon={DollarSign} color="emerald" />
          {showProfitMetric && (
            <MetricCard
              title="Ganancias del mes"
              value={formatCurrency(profitMetric)}
              icon={TrendingUp}
              color={profitMetric >= 0 ? "emerald" : "red"}
            />
          )}
          <MetricCard title="Citas hoy" value={String(metrics.todayAppointments)} icon={CalendarDays} color="blue" />
        </div>
      )}

      {(canManageAppointments || canViewReports) && (
        <div className="space-y-4">
          {canManageAppointments && <PendingConfirmations pending={pending} />}
          {canViewReports && (
            <div className="grid gap-4 xl:grid-cols-2">
              <MonthlyAppointmentsChart points={monthlyCompletedAppointments} />
              <TopServices services={topServices} />
            </div>
          )}
        </div>
      )}

      {!metrics && quickLinks.length > 0 && (
        <div className="grid max-w-lg gap-3 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-4 rounded-xl border border-brand-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                <link.icon className="h-5 w-5 text-brand-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-900">{link.label}</p>
                <p className="truncate text-xs text-stone-400">{link.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

      {!hasAnyAccess && (
        <div className="flex max-w-md items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            No tienes módulos asignados. Pide al administrador del salón que configure tu rol en la sección{" "}
            <strong>Colaboradores</strong>.
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
  color: "blue" | "emerald" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
          </div>
          <div className={cn("rounded-lg p-2", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingConfirmations({ pending }: { pending: PendingAppointmentConfirmation[] }) {
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
          <p className="py-6 text-center text-sm text-stone-400">No hay citas pendientes de confirmar.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-stone-400">Recuérdale a estos clientes que confirmen su cita:</p>
            <ul className="space-y-2.5">
              {pending.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">{appointment.customerName}</p>
                    <p className="flex items-center gap-1 text-xs text-stone-400">
                      <Clock className="h-3 w-3" /> {appointment.when}
                    </p>
                  </div>
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
          Servicios más solicitados
          <span className="ml-auto text-xs font-normal text-stone-400">Este mes</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">Aún no hay datos suficientes este mes.</p>
        ) : (
          <div
            className="relative h-[264px] min-w-0"
            role="img"
            aria-label="Servicios más solicitados este mes"
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-2 top-4 bottom-14 flex flex-col justify-between"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className="border-t border-dashed border-brand-100" />
              ))}
            </div>
            <div className="relative flex h-full items-end gap-3 px-2 pt-4">
              {services.map((service) => (
                <div key={service.name} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-3">
                  <div className="relative flex h-[198px] w-full items-end justify-center">
                    <div className="pointer-events-none absolute -top-2 z-10 rounded-md bg-stone-900 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                      {service.count}
                    </div>
                    <div
                      className="w-full max-w-10 rounded-t-md bg-brand-600 transition-[height,opacity,transform] duration-150 group-hover:-translate-y-1 group-hover:opacity-90"
                      style={{ height: `${Math.max(service.pct, 12)}%` }}
                    />
                  </div>
                  <span className="line-clamp-2 min-h-8 text-center text-[10px] font-medium uppercase leading-tight text-stone-400">
                    {service.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
