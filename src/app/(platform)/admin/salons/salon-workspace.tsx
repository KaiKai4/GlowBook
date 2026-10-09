"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Gauge,
  ShieldAlert,
  Users,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type {
  SalonSubscriptionDetail,
  SalonSubscriptionRow,
  SubscriptionsPageData,
} from "@/features/billing/use-cases/salon-subscriptions";
import { cn } from "@/lib/utils/cn";
import { MiniMetric, Panel } from "../plans/workspace-ui";
import { UsagePanel } from "../subscriptions/usage-panel";
import { DeleteSalonButton } from "./delete-salon-button";
import { SalonStatusControl } from "./salon-status-control";

export interface SalonWorkspaceSalon {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  isActive: boolean;
  createdAtLabel: string;
  ownerNames: string[];
  customerCount: number;
  collaboratorCount: number;
  appointmentCount: number;
  serviceCount: number;
}

type SalonTab = "summary" | "usage" | "actions";

const SALON_TABS: Array<{ key: SalonTab; label: string; icon: React.ReactNode }> = [
  { key: "summary", label: "Resumen", icon: <Building2 className="h-4 w-4" /> },
  { key: "usage", label: "Plan y uso", icon: <Gauge className="h-4 w-4" /> },
  { key: "actions", label: "Acciones", icon: <ShieldAlert className="h-4 w-4" /> },
];

const STATUS_LABELS: Record<string, string> = {
  trialing: "En trial",
  active: "Activo",
  past_due: "Moroso",
  paused: "Pausado",
  canceled: "Cancelado",
};

export function SalonWorkspace({
  salon,
  row,
  detail,
  modules,
}: {
  salon: SalonWorkspaceSalon;
  row: SalonSubscriptionRow | null;
  detail: SalonSubscriptionDetail;
  modules: SubscriptionsPageData["modules"];
}) {
  const [tab, setTab] = useState<SalonTab>("summary");
  const warningCount = detail.limits.filter((limit) => limit.warningLevel !== "none").length;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold text-fg-strong">{salon.name}</h2>
            <StatusBadge
              variant={salon.isActive ? "success" : "danger"}
              label={salon.isActive ? "Activo" : "Suspendido"}
            />
          </div>
          <p className="mt-1 text-sm text-fg-subtle">
            {row?.planName
              ? `${row.planName} · ${STATUS_LABELS[row.status ?? ""] ?? "Sin estado"} · ${row.currency} ${row.monthlyTotal.toFixed(2)}/mes`
              : "Sin plan asignado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SALON_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                tab === item.key
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-brand-100 bg-surface text-fg-muted hover:border-brand-200 hover:text-brand-700"
              )}
            >
              {item.icon}
              {item.label}
              {item.key === "usage" && warningCount > 0 ? (
                <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs text-warning-strong">{warningCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "summary" ? <SummaryTab salon={salon} row={row} detail={detail} /> : null}
        {tab === "usage" ? <UsageTab detail={detail} row={row} modules={modules} salonId={salon.id} /> : null}
        {tab === "actions" ? <ActionsTab salon={salon} /> : null}
      </div>
    </section>
  );
}

function SummaryTab({
  salon,
  row,
  detail,
}: {
  salon: SalonWorkspaceSalon;
  row: SalonSubscriptionRow | null;
  detail: SalonSubscriptionDetail;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniMetric label="Clientes" value={String(salon.customerCount)} />
        <MiniMetric label="Colaboradores" value={String(salon.collaboratorCount)} />
        <MiniMetric label="Citas" value={String(salon.appointmentCount)} />
        <MiniMetric label="Servicios" value={String(salon.serviceCount)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          icon={<Building2 className="h-4 w-4" />}
          title="Datos de contacto"
          description="Informacion registrada del salon."
        >
          <dl className="space-y-3 text-sm">
            <InfoRow label="Correo" value={salon.contactEmail || "Sin correo registrado"} />
            <InfoRow label="Teléfono" value={salon.phone || "Sin teléfono"} />
            <InfoRow label="Registrado" value={salon.createdAtLabel} />
            <InfoRow label="ID" value={salon.id} mono />
          </dl>
        </Panel>

        <Panel
          icon={<Users className="h-4 w-4" />}
          title="Owners y suscripcion"
          description="Quien administra el salon y que plan tiene."
        >
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Owners</p>
              {salon.ownerNames.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {salon.ownerNames.map((owner) => (
                    <li key={owner} className="font-medium text-fg-secondary">{owner}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-fg-subtle">Sin owner</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Plan</p>
              <p className="mt-1 font-medium text-fg-secondary">
                {row?.planName ?? "Sin plan asignado"}
                {row?.planName ? ` · ${row.currency} ${row.monthlyTotal.toFixed(2)}/mes` : ""}
              </p>
              {detail.assignment?.currentPeriodEnd ? (
                <p className="mt-0.5 text-xs text-success-fg">
                  Pagado hasta {formatDate(detail.assignment.currentPeriodEnd)}
                </p>
              ) : detail.assignment?.trialEndsAt ? (
                <p className="mt-0.5 text-xs text-info-fg">
                  Trial hasta {formatDate(detail.assignment.trialEndsAt)}
                </p>
              ) : null}
            </div>
            <Link
              href={`/admin/subscriptions?salon=${salon.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              Gestionar suscripcion y extras
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function UsageTab({
  detail,
  row,
  modules,
  salonId,
}: {
  detail: SalonSubscriptionDetail;
  row: SalonSubscriptionRow | null;
  modules: SubscriptionsPageData["modules"];
  salonId: string;
}) {
  return (
    <div className="space-y-5">
      {detail.plan ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniMetric label="Plan" value={detail.plan.name} />
          <MiniMetric label="Estado" value={STATUS_LABELS[detail.assignment?.status ?? ""] ?? "—"} />
          <MiniMetric label="Total mensual" value={`${detail.plan.currency} ${detail.monthlyTotal.toFixed(2)}`} />
          <MiniMetric
            label={detail.assignment?.currentPeriodEnd ? "Pagado hasta" : "Trial termina"}
            value={
              detail.assignment?.currentPeriodEnd
                ? formatDate(detail.assignment.currentPeriodEnd)
                : detail.assignment?.trialEndsAt
                  ? formatDate(detail.assignment.trialEndsAt)
                  : "—"
            }
          />
        </div>
      ) : null}

      <UsagePanel detail={detail} modules={modules} />

      <Link
        href={`/admin/subscriptions?salon=${salonId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
      >
        {row?.planName ? "Cambiar plan, registrar pago o dar extras" : "Asignar un plan a este salon"}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function ActionsTab({ salon }: { salon: SalonWorkspaceSalon }) {
  return (
    <div className="max-w-xl space-y-5">
      <Panel
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Estado del salon"
        description="Suspender bloquea el acceso de todos los usuarios del salon sin borrar datos."
      >
        <SalonStatusControl salonId={salon.id} salonName={salon.name} isActive={salon.isActive} />
      </Panel>

      <Panel
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Zona de peligro"
        description="Eliminar el salon borra todos sus datos de forma permanente."
      >
        <DeleteSalonButton salonId={salon.id} salonName={salon.name} />
      </Panel>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-fg-subtle">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right font-medium text-fg-secondary", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}
