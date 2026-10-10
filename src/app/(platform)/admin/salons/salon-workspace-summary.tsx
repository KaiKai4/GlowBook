import Link from "next/link";
import { ArrowUpRight, Building2, Users } from "lucide-react";

import { cn } from "@/components/ui/cn";
import type { SalonSubscriptionDetail } from "@/features/billing";
import type { SalonSubscriptionRow } from "@/features/billing/domain/salon-subscription-rows";
import { MiniMetric, Panel } from "../plans/workspace-ui";
import type { SalonWorkspaceSalon } from "./salon-workspace-types";
import { formatShortDateFromISO } from "@/infra/format/dates";

export function SummaryTab({
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
          description="Información registrada del salón."
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
          title="Owners y suscripción"
          description="Quien administra el salón y que plan tiene."
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
                  Pagado hasta {formatShortDateFromISO(detail.assignment.currentPeriodEnd)}
                </p>
              ) : detail.assignment?.trialEndsAt ? (
                <p className="mt-0.5 text-xs text-info-fg">
                  Trial hasta {formatShortDateFromISO(detail.assignment.trialEndsAt)}
                </p>
              ) : null}
            </div>
            <Link
              href={`/admin/subscriptions?salon=${salon.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              Gestionar suscripción y extras
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Panel>
      </div>
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
