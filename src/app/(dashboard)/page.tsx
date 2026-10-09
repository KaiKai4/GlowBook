import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/infra/auth/session";
import { getEffectiveDisabledSalonFeatures } from "@/features/billing/use-cases/commercial-plans";
import { getPermissions, hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { isSalonFeatureDisabled } from "@/features/salon/domain/salon-features";
import { getDashboardOverview } from "@/features/dashboard/use-cases/get-dashboard-overview";
import { selectDashboardMoney } from "@/features/dashboard/domain/dashboard-money";
import {
  getOwnerPlanLimitWarnings,
  getSalonPaymentStanding,
} from "@/features/salon/use-cases/get-dashboard-shell";
import { PlanLimitBanner } from "@/components/layout/plan-limit-banner";
import { PaymentStandingBanner } from "@/components/layout/payment-standing-banner";
import { getOnboardingChecklist } from "@/features/dashboard/use-cases/get-onboarding-checklist";
import { OnboardingChecklistCard } from "./onboarding-checklist-card";
import { formatCurrency, formatDate } from "@/infra/format/dates";
import { MonthlyAppointmentsChart } from "./monthly-appointments-chart";
import { PendingConfirmations, TopServices } from "./dashboard-widgets";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { AlertCircle, CalendarDays, ChevronRight, Users } from "lucide-react";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const disabledFeatures = await getEffectiveDisabledSalonFeatures(profile);
  const visibleNav = getVisibleNavItems(
    getPermissions(profile),
    profile.is_owner,
    disabledFeatures
  );

  const [onlyNavItem] = visibleNav;
  if (!profile.is_owner && visibleNav.length === 1 && onlyNavItem && onlyNavItem.href !== "/") redirect(onlyNavItem.href);

  // Los avisos del plan (límites y pago vencido) y la guia de arranque solo
  // viven aqui: el owner los ve al entrar, sin perseguirlo por los modulos.
  const [planWarnings, paymentStanding, onboarding] = profile.is_owner
    ? await Promise.all([
        getOwnerPlanLimitWarnings(profile.salon_id),
        getSalonPaymentStanding(profile.salon_id),
        getOnboardingChecklist(profile.salon_id),
      ])
    : [[], null, null];

  const canViewReports = hasPermission(profile, PERMISSIONS.REPORTS_VIEW);
  const canManageAppointments = hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE);
  const canViewAppointments = canManageAppointments || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW);
  const canManageCustomers = hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE);
  const hasExpensesFeature = !isSalonFeatureDisabled(disabledFeatures, "expenses");
  const hasRetailFeature = !isSalonFeatureDisabled(disabledFeatures, "retail");
  const hasInventoryFeature = !isSalonFeatureDisabled(disabledFeatures, "inventory");

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
  const money = metrics
    ? selectDashboardMoney(metrics, { includeRetail: hasRetailFeature, includeExpenses: hasExpensesFeature })
    : { revenue: 0, profit: 0 };
  const showProfitMetric = Boolean(metrics && (hasRetailFeature || hasExpensesFeature));

  return (
    <div className="space-y-6">
      {paymentStanding ? <PaymentStandingBanner standing={paymentStanding} /> : null}
      <PlanLimitBanner warnings={planWarnings} />

      <PageHeader title="Bienvenido" description={formatDate(new Date())} />

      {onboarding ? <OnboardingChecklistCard checklist={onboarding} /> : null}

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hasExpensesFeature && (
            <MetricCard label="Gastos del mes" value={formatCurrency(metrics.monthExpenses)} />
          )}
          <MetricCard label="Ingresos del mes" value={formatCurrency(money.revenue)} />
          {showProfitMetric && (
            <MetricCard
              label="Ganancias del mes"
              value={formatCurrency(money.profit)}
              tone={money.profit >= 0 ? "default" : "danger"}
            />
          )}
          <MetricCard label="Citas hoy" value={String(metrics.todayAppointments)} />
          <MetricCard label="Citas completadas (mes)" value={String(metrics.completedThisMonth)} />
          <MetricCard label="Clientes registrados" value={String(metrics.totalCustomers)} />
          {hasInventoryFeature && (
            <MetricCard
              label="Productos con bajo stock"
              value={String(metrics.lowStockProducts)}
              tone={metrics.lowStockProducts > 0 ? "danger" : "default"}
            />
          )}
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
              className="group flex items-center gap-4 rounded-xl border border-brand-100 bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                <link.icon className="h-5 w-5 text-brand-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-fg">{link.label}</p>
                <p className="truncate text-xs text-fg-subtle">{link.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-fg-disabled transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

      {!hasAnyAccess && (
        <div className="flex max-w-md items-start gap-3 rounded-xl border border-warning-border bg-warning-subtle px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" />
          <p className="text-sm text-warning-strong">
            No tienes módulos asignados. Pide al administrador del salón que configure tu rol en la sección{" "}
            <strong>Colaboradores</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
