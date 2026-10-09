import Link from "next/link";
import {
  AlertTriangle,
  BadgeDollarSign,
  Building2,
  CreditCard,
  History,
  Hourglass,
  MailOpen,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getSubscriptionsPage, type SalonSubscriptionRow } from "@/features/billing/use-cases/salon-subscriptions";
import { getPlatformAdminHome } from "@/features/platform/use-cases/get-platform-admin-home";
import { getPlatformSalonOverviews } from "@/features/platform/use-cases/get-platform-salon-overviews";
import { requirePlatformAdmin } from "@/infra/auth/session";
import { buildAttentionList } from "./home-attention";
import { AdminShortcut, HomeMetric } from "./home-widgets";
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
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-surface px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administración global
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-fg-strong">
            Panel de Plataforma
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-subtle">
            Estado del negocio: ingresos, salones, suscripciones y lo que requiere tu atención hoy.
          </p>
        </div>
        <Link
          href="/admin/invitations"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-surface shadow-sm transition hover:bg-brand-700"
        >
          <MailOpen className="h-4 w-4" />
          Invitar salon
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HomeMetric
          icon={<BadgeDollarSign className="h-5 w-5 text-success-fg" />}
          label="MRR estimado"
          value={`$${billing.totals.mrr.toFixed(2)}`}
        />
        <HomeMetric
          icon={<Building2 className="h-5 w-5 text-info-fg" />}
          label="Salones activos"
          value={`${home.metrics.activeSalons} de ${home.metrics.totalSalons}`}
        />
        <HomeMetric
          icon={<Hourglass className="h-5 w-5 text-info-fg" />}
          label="En trial"
          value={String(billing.totals.trialing)}
        />
        <HomeMetric
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
          label="Alertas abiertas"
          value={String(billing.totals.openAlerts)}
          highlight={billing.totals.openAlerts > 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-subtle bg-surface pb-5">
            <CardTitle>Requieren atención</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center">
                <p className="text-sm text-fg-subtle">
                  Todo en orden: sin alertas, morosos, trials por vencer ni salones dormidos.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {attention.map((item) => (
                  <li key={`${item.salonId}-${item.reason}`}>
                    <Link
                      href={`/admin/subscriptions?salon=${item.salonId}`}
                      className="flex items-center justify-between gap-3 py-3 transition hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg">{item.salonName}</p>
                        <p className="mt-0.5 text-xs text-fg-subtle">{item.detail}</p>
                      </div>
                      <StatusBadge variant={item.severity === "danger" ? "danger" : "warning"} label={item.reason} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-subtle bg-surface pb-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Invitaciones pendientes</CardTitle>
              <Link href="/admin/invitations" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Gestionar
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {home.pendingInvitations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center">
                <p className="text-sm text-fg-subtle">No hay invitaciones pendientes.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {home.pendingInvitations.slice(0, 5).map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 truncate text-sm font-medium text-fg-secondary">
                      {invitation.email}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <RegenerateInviteLink invitationId={invitation.id} />
                      <StatusBadge variant="warning" label="Pendiente" />
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
          <CardHeader className="border-b border-border-subtle bg-surface pb-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Suscripciones</CardTitle>
              <Link href="/admin/subscriptions" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Ver todas
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border-subtle">
              {billing.rows.slice(0, 8).map((row) => (
                <Link
                  key={row.salonId}
                  href={`/admin/subscriptions?salon=${row.salonId}`}
                  className="flex items-center justify-between gap-4 py-3 transition hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg-strong">{row.salonName}</p>
                    <p className="truncate text-xs text-fg-subtle">
                      {row.planName
                        ? `${row.planName} · ${row.currency} ${row.monthlyTotal.toFixed(2)}/mes`
                        : "Sin plan asignado"}
                    </p>
                  </div>
                  <StatusBadge variant={statusBadge(row.status)} label={statusLabel(row.status)} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-subtle bg-surface pb-5">
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
              icon={<History className="h-4 w-4 text-success-fg" />}
              title="Auditoria"
              detail="Eventos cross-tenant"
            />
            <AdminShortcut
              href="/admin/reports"
              icon={<MessageSquareWarning className="h-4 w-4 text-warning-fg" />}
              title="Reportes"
              detail="Fallas y sugerencias de salones"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function statusLabel(status: SalonSubscriptionRow["status"]): string {
  if (status === "trialing") return "Trial";
  if (status === "active") return "Activo";
  if (status === "past_due") return "Moroso";
  if (status === "paused") return "Pausado";
  if (status === "canceled") return "Cancelado";
  return "Sin plan";
}

function statusBadge(status: SalonSubscriptionRow["status"]): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "trialing") return "warning";
  if (status === "past_due" || status === "canceled") return "danger";
  return "neutral";
}
