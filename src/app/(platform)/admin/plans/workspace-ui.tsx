"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2, Layers3, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { PlatformPlanActionState } from "./action-state";

export function Panel({ icon, title, description, children, compact = false }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={cn("rounded-xl border border-brand-100 bg-white shadow-sm", compact ? "p-4" : "p-5")}>
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-stone-950">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-stone-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ToggleRow({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/50 px-3 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500" />
    </label>
  );
}

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="w-full" loading={pending}>
      {pending ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      {label}
    </Button>
  );
}

export function SaveAllButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      {!pending ? <Save className="h-4 w-4" /> : null}
      {label}
    </Button>
  );
}

export function InlineState({ state, block = false }: { state: PlatformPlanActionState; block?: boolean }) {
  if (!state.message) return null;
  return (
    <p className={cn(
      block ? "mt-3 rounded-xl px-3 py-2 text-sm font-medium" : "mt-2 text-xs font-medium",
      state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
    )}>
      {state.message}
    </p>
  );
}

export function StatusPill({ status }: { status: "draft" | "active" | "archived" }) {
  return (
    <span className={cn(
      "rounded-lg px-2 py-1 text-xs font-semibold",
      status === "active" ? "bg-emerald-50 text-emerald-700" : status === "archived" ? "bg-stone-100 text-stone-500" : "bg-sky-50 text-sky-700"
    )}>
      {statusLabel(status)}
    </span>
  );
}

export function StatusText({ active, activeText, inactiveText }: { active: boolean; activeText: string; inactiveText: string }) {
  return (
    <span className={cn(
      "rounded-lg px-2 py-1 text-xs font-semibold",
      active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
    )}>
      {active ? activeText : inactiveText}
    </span>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-stone-950">{value}</p>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-sm text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-300">
        <Layers3 className="h-8 w-8" />
      </div>
      <p className="mt-5 font-semibold text-stone-700">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

export function statusLabel(status: "draft" | "active" | "archived") {
  if (status === "active") return "Activo";
  if (status === "archived") return "Archivado";
  return "Borrador";
}

export function modeLabel(mode: string) {
  if (mode === "block") return "Bloqueo";
  if (mode === "warn") return "Advertencia";
  return "Sin control";
}

export function countScopeLabel(scope: string) {
  if (scope === "billing_cycle") return "Ciclo de facturacion";
  if (scope === "monthly") return "Mes calendario";
  if (scope === "lifetime") return "Historico total";
  return "Actual";
}
