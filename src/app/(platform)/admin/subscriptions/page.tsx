import { AlertTriangle, BadgeDollarSign, Building2, Hourglass } from "lucide-react";

import { getSalonSubscriptionDetail } from "@/features/billing";
import { getSubscriptionsPage } from "@/features/billing";
import { PageHeader } from "@/components/ui/page-header";
import { getPlatformSalonOverviews } from "@/features/platform";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { SalonSubscriptionList } from "./salon-list";
import { SubscriptionDetail } from "./subscription-detail";

export default async function PlatformSubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ salon?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const salonView = await getPlatformSalonOverviews();
  const data = await getSubscriptionsPage(salonView.salons);

  const selectedSalonId =
    data.rows.find((row) => row.salonId === params?.salon)?.salonId ?? data.rows[0]?.salonId ?? null;
  const selectedRow = data.rows.find((row) => row.salonId === selectedSalonId) ?? null;
  const detail = selectedSalonId ? await getSalonSubscriptionDetail(selectedSalonId) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Suscripciones"
        description="Asigna planes a salones, vende o regala extras y revisa que tanto usan de su plan."
        actions={
          <>
            <HeaderMetric
              icon={<BadgeDollarSign className="h-4 w-4" />}
              label="MRR estimado"
              value={`$${data.totals.mrr.toFixed(2)}`}
              accent="success"
            />
            <HeaderMetric icon={<Building2 className="h-4 w-4" />} label="Con plan" value={String(data.totals.salonsWithPlan)} />
            <HeaderMetric icon={<Hourglass className="h-4 w-4" />} label="En trial" value={String(data.totals.trialing)} />
            <HeaderMetric
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Alertas"
              value={String(data.totals.openAlerts)}
              accent={data.totals.openAlerts > 0 ? "warning" : "default"}
            />
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-soft">
        <div className="grid h-[calc(100vh-210px)] min-h-[540px] lg:grid-cols-[320px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-brand-100 bg-surface-muted/60 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Salones</p>
                <p className="mt-1 text-sm text-fg-subtle">{data.rows.length} registrados</p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {data.totals.salonsWithPlan} con plan
              </span>
            </div>
            <SalonSubscriptionList rows={data.rows} selectedSalonId={selectedSalonId} />
          </aside>

          {detail && selectedRow ? (
            <SubscriptionDetail
              salonName={selectedRow.salonName}
              detail={detail}
              catalog={{
                plans: data.plans,
                addons: data.addons,
                metrics: data.metrics,
                modules: data.modules,
              }}
            />
          ) : (
            <div className="flex items-center justify-center p-8">
              <p className="max-w-sm text-center text-sm leading-6 text-fg-subtle">
                No hay salones registrados todavía. Invita un salón desde Invitaciones para asignarle un plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderMetric({
  icon,
  label,
  value,
  accent = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "default" | "success" | "warning";
}) {
  return (
    <div className="inline-flex h-11 items-center gap-3 rounded-xl border border-brand-100 bg-surface px-4 shadow-sm">
      <span className={accent === "success" ? "text-success-fg" : accent === "warning" ? "text-warning" : "text-brand-600"}>
        {icon}
      </span>
      <span className="text-xl font-semibold text-fg-strong">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</span>
    </div>
  );
}
