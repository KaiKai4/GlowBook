import Link from "next/link";
import { ArrowUpRight, ShieldAlert } from "lucide-react";

import type { SalonSubscriptionDetail } from "@/features/billing/use-cases/salon-subscription-detail";
import type { SalonSubscriptionRow } from "@/features/billing/domain/salon-subscription-rows";
import type { SubscriptionsPageData } from "@/features/billing/use-cases/salon-subscriptions-page";
import { MiniMetric, Panel } from "../plans/workspace-ui";
import { UsagePanel } from "../subscriptions/usage-panel";
import { DeleteSalonButton } from "./delete-salon-button";
import { SalonStatusControl } from "./salon-status-control";
import type { SalonWorkspaceSalon } from "./salon-workspace-types";
import { formatDate, STATUS_LABELS } from "./salon-workspace-format";

export function UsageTab({
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
        {row?.planName ? "Cambiar plan, registrar pago o dar extras" : "Asignar un plan a este salón"}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export function ActionsTab({ salon }: { salon: SalonWorkspaceSalon }) {
  return (
    <div className="max-w-xl space-y-5">
      <Panel
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Estado del salón"
        description="Suspender bloquea el acceso de todos los usuarios del salón sin borrar datos."
      >
        <SalonStatusControl salonId={salon.id} salonName={salon.name} isActive={salon.isActive} />
      </Panel>

      <Panel
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Zona de peligro"
        description="Eliminar el salón borra todos sus datos de forma permanente."
      >
        <DeleteSalonButton salonId={salon.id} salonName={salon.name} />
      </Panel>
    </div>
  );
}
