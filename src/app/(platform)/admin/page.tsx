import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CreditCard,
  History,
  Hourglass,
  MailOpen,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSubscriptionsPage, type SalonSubscriptionRow } from "@/features/billing/use-cases/salon-subscriptions";
import { getPlatformAdminHome } from "@/features/platform/use-cases/get-platform-admin-home";
import { getPlatformSalonOverviews } from "@/features/platform/use-cases/get-platform-salon-overviews";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { RegenerateInviteLink } from "./regenerate-invite-link";

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();

  const [home, salonView] = await Promise.all([
    getPlatformAdminHome(),
    getPlatformSalonOverviews(),
  ]);
  const billing = await getSubscriptionsPage(salonView.salons);
  // Salones dormidos (sin citas en 30 días) entran a la lista de atención:
  // son los candidatos a churn que conviene contactar antes de que cancelen.
  const attention = [
    ...buildAttentionList(billing.rows),
    ...salonView.dormantSalons.map((salon) => ({
      salonId: salon.id,
      salonName: salon.name,
      reason: "Dormido",
      detail: "Sin citas en los últimos 30 días: contacto recomendado.",
      severity: "warning" as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administración global
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-950">
            Panel de Plataforma
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Estado del negocio: ingresos, salones, suscripciones y lo que requiere tu atención hoy.
          </p>
        </div>
        <Link
          href="/admin/invitations"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          <MailOpen className="h-4 w-4" />
          Invitar salon
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HomeMetric
          icon={<BadgeDollarSign className="h-5 w-5 text-emerald-600" />}
          label="MRR estimado"
          value={`$${billing.totals.mrr.toFixed(2)}`}
        />
        <HomeMetric
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          label="Salones activos"
          value={`${home.metrics.activeSalons} de ${home.metrics.totalSalons}`}
        />
        <HomeMetric
          icon={<Hourglass className="h-5 w-5 text-sky-600" />}
          label="En trial"
          value={String(billing.totals.trialing)}
        />
        <HomeMetric
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          label="Alertas abiertas"
          value={String(billing.totals.openAlerts)}
          highlight={billing.totals.openAlerts > 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <CardTitle>Requieren atención</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
                <p className="text-sm text-neutral-400">
                  Todo en orden: sin alertas, morosos, trials por vencer ni salones dormidos.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {attention.map((item) => (
                  <li key={`${item.salonId}-${item.reason}`}>
                    <Link
                      href={`/admin/subscriptions?salon=${item.salonId}`}
                      className="flex items-center justify-between gap-3 py-3 transition hover:bg-neutral-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{item.salonName}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{item.detail}</p>
                      </div>
                      <Badge variant={item.severity === "danger" ? "danger" : "warning"}>{item.reason}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Invitaciones pendientes</CardTitle>
              <Link href="/admin/invitations" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Gestionar
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {home.pendingInvitations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
                <p className="text-sm text-neutral-400">No hay invitaciones pendientes.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {home.pendingInvitations.slice(0, 5).map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 truncate text-sm font-medium text-neutral-800">
                      {invitation.email}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <RegenerateInviteLink invitationId={invitation.id} />
                      <Badge variant="warning">Pendiente</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Suscripciones</CardTitle>
              <Link href="/admin/subscriptions" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Ver todas
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-neutral-100">
              {billing.rows.slice(0, 8).map((row) => (
                <Link
                  key={row.salonId}
                  href={`/admin/subscriptions?salon=${row.salonId}`}
                  className="flex items-center justify-between gap-4 py-3 transition hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-950">{row.salonName}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {row.planName
                        ? `${row.planName} · ${row.currency} ${row.monthlyTotal.toFixed(2)}/mes`
                        : "Sin plan asignado"}
                    </p>
                  </div>
                  <Badge variant={statusBadge(row.status)}>{statusLabel(row.status)}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <CardTitle>Accesos administrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AdminShortcut
              href="/admin/plans"
              icon={<CreditCard className="h-4 w-4 text-brand-600" />}
              title="Planes y extras"
              detail="Catalogo comercial, modulos y límites"
            />
            <AdminShortcut
              href="/admin/audit"
              icon={<History className="h-4 w-4 text-emerald-600" />}
              title="Auditoria"
              detail="Eventos cross-tenant"
            />
            <AdminShortcut
              href="/admin/reports"
              icon={<MessageSquareWarning className="h-4 w-4 text-amber-600" />}
              title="Reportes"
              detail="Fallas y sugerencias de salones"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface AttentionItem {
  salonId: string;
  salonName: string;
  reason: string;
  detail: string;
  severity: "warning" | "danger";
}

function buildAttentionList(rows: SalonSubscriptionRow[]): AttentionItem[] {
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const soonIso = soon.toISOString().slice(0, 10);
  const items: AttentionItem[] = [];

  for (const row of rows) {
    if (row.openAlertCount > 0) {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Límites",
        detail: `${row.openAlertCount} alerta${row.openAlertCount === 1 ? "" : "s"} de límite abierta${row.openAlertCount === 1 ? "" : "s"}.`,
        severity: "danger",
      });
    }
    if (row.status === "past_due") {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Moroso",
        detail: "Pago vencido: registra el pago o pausa la suscripcion.",
        severity: "danger",
      });
    }
    if (row.status === "trialing" && row.trialEndsAt && row.trialEndsAt <= soonIso) {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Trial por vencer",
        detail: `El trial termina el ${formatDate(row.trialEndsAt)}. Contacta al salon para cerrar la venta.`,
        severity: "warning",
      });
    }
    if (row.planId === null && row.salonIsActive) {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Sin plan",
        detail: "Salon activo sin plan: ve todo sin límites.",
        severity: "warning",
      });
    }
  }

  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));
}

function statusLabel(status: SalonSubscriptionRow["status"]): string {
  if (status === "trialing") return "Trial";
  if (status === "active") return "Activo";
  if (status === "past_due") return "Moroso";
  if (status === "paused") return "Pausado";
  if (status === "canceled") return "Cancelado";
  return "Sin plan";
}

function statusBadge(status: SalonSubscriptionRow["status"]): "success" | "warning" | "danger" | "default" {
  if (status === "active") return "success";
  if (status === "trialing") return "warning";
  if (status === "past_due" || status === "canceled") return "danger";
  return "default";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short" }).format(
    new Date(`${value}T00:00:00`)
  );
}

function HomeMetric({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${highlight ? "text-amber-600" : "text-neutral-950"}`}>
              {value}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminShortcut({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 transition-colors hover:border-brand-200 hover:bg-white"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl bg-white p-2 shadow-sm">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950">{title}</p>
          <p className="truncate text-xs text-neutral-500">{detail}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </Link>
  );
}
