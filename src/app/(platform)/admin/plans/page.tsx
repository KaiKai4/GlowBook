import Link from "next/link";
import { Blocks, CreditCard, Gauge, Gift, Layers3, Plus } from "lucide-react";

import { getCommercialPlansPage } from "@/features/billing/use-cases/commercial-plans";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";
import { AddonsCatalog } from "./addons-catalog";
import { PlansWorkspace } from "./plans-workspace";

export default async function PlatformPlansPage({
  searchParams,
}: {
  searchParams?: Promise<{ new?: string; view?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const view = params?.view === "addons" ? "addons" : "plans";
  const billing = await getCommercialPlansPage();
  const activePlans = billing.plans.filter((plan) => plan.status === "active").length;
  const assignedSalons = Object.values(billing.assignmentsByPlan).reduce((total, count) => total + count, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Planes y extras</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
            {view === "plans"
              ? "Crea planes comerciales, activa modulos y define límites maximos por plan."
              : "Define el catalogo de extras: modulos sueltos y bloques de límite para vender o regalar."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderMetric icon={<CreditCard className="h-4 w-4" />} label="Planes" value={billing.plans.length} />
          <HeaderMetric icon={<Gauge className="h-4 w-4" />} label="Activos" value={activePlans} accent="success" />
          <HeaderMetric icon={<Blocks className="h-4 w-4" />} label="Asignados" value={assignedSalons} />
          <HeaderMetric icon={<Gift className="h-4 w-4" />} label="Extras" value={billing.addons.length} />
          {view === "plans" ? (
            <Link
              href="/admin/plans?new=1#new-plan"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Nuevo plan
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-xl border border-brand-100 bg-white p-1 shadow-sm">
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
        active ? "bg-brand-600 text-white shadow-sm" : "text-stone-600 hover:bg-brand-50 hover:text-brand-700"
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
    <div className="inline-flex h-11 items-center gap-3 rounded-xl border border-brand-100 bg-white px-4 shadow-sm">
      <span className={accent === "success" ? "text-emerald-600" : "text-brand-600"}>{icon}</span>
      <span className="text-xl font-bold text-neutral-950">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{label}</span>
    </div>
  );
}
