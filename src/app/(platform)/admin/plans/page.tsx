import Link from "next/link";
import { Blocks, CreditCard, Gauge, Gift, Layers3, Plus } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { getCommercialPlansPage } from "@/features/billing";
import { requirePlatformAdminProof } from "@/app/_composition/request-context";
import { cn } from "@/components/ui/cn";
import { AddonsCatalog } from "./addons-catalog";
import { PlansWorkspace } from "./plans-workspace";

export default async function PlatformPlansPage({
  searchParams,
}: {
  searchParams?: Promise<{ new?: string; view?: string }>;
}) {
  const proof = await requirePlatformAdminProof();
  const params = await searchParams;
  const view = params?.view === "addons" ? "addons" : "plans";
  const billing = await getCommercialPlansPage(proof);
  const activePlans = billing.plans.filter((plan) => plan.status === "active").length;
  const assignedSalons = Object.values(billing.assignmentsByPlan).reduce((total, count) => total + count, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Planes y extras"
        description={
          view === "plans"
            ? "Crea planes comerciales, activa módulos y define límites maximos por plan."
            : "Define el catálogo de extras: módulos sueltos y bloques de límite para vender o regalar."
        }
        actions={
          <>
            <HeaderMetric icon={<CreditCard className="h-4 w-4" />} label="Planes" value={billing.plans.length} />
            <HeaderMetric icon={<Gauge className="h-4 w-4" />} label="Activos" value={activePlans} accent="success" />
            <HeaderMetric icon={<Blocks className="h-4 w-4" />} label="Asignados" value={assignedSalons} />
            <HeaderMetric icon={<Gift className="h-4 w-4" />} label="Extras" value={billing.addons.length} />
            {view === "plans" ? (
              <Link
                href="/admin/plans?new=1#new-plan"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-surface shadow-sm transition hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                Nuevo plan
              </Link>
            ) : null}
          </>
        }
      />

      <div className="flex w-fit items-center gap-1 rounded-xl border border-brand-100 bg-surface p-1 shadow-sm">
        <ViewTab href="/admin/plans" active={view === "plans"} icon={<Layers3 className="h-4 w-4" />}>
          Planes
        </ViewTab>
        <ViewTab href="/admin/plans?view=addons" active={view === "addons"} icon={<Gift className="h-4 w-4" />}>
          Extras
        </ViewTab>
      </div>

      {view === "plans" ? (
        <PlansWorkspace
          data={{
            modules: billing.modules,
            metrics: billing.metrics,
            plans: billing.plans,
            assignmentsByPlan: billing.assignmentsByPlan,
          }}
          startInCreateMode={params?.new === "1"}
        />
      ) : (
        <AddonsCatalog
          data={{
            addons: billing.addons,
            modules: billing.modules,
            metrics: billing.metrics,
          }}
        />
      )}
    </div>
  );
}

function ViewTab({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
        active ? "bg-brand-600 text-surface shadow-sm" : "text-fg-muted hover:bg-brand-50 hover:text-brand-700"
      )}
    >
      {icon}
      {children}
    </Link>
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
  value: number;
  accent?: "default" | "success";
}) {
  return (
    <div className="inline-flex h-11 items-center gap-3 rounded-xl border border-brand-100 bg-surface px-4 shadow-sm">
      <span className={accent === "success" ? "text-success-fg" : "text-brand-600"}>{icon}</span>
      <span className="text-xl font-semibold text-fg-strong">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</span>
    </div>
  );
}
