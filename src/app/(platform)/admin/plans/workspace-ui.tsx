"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2, Layers3, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { PlatformPlanActionState } from "./action-state";

export function Panel({ icon, title, description, children, compact = false }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={cn("rounded-xl border border-brand-100 bg-surface shadow-sm", compact ? "p-4" : "p-5")}>
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-fg-strong">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-fg-subtle">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ToggleRow({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/50 px-3 text-sm font-medium text-fg-secondary">
      <span>{label}</span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500" />
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
      state.ok ? "bg-success-subtle text-success-strong" : "bg-danger-subtle text-danger-strong"
    )}>
      {state.message}
    </p>
  );
}

export function StatusPill({ status }: { status: "draft" | "active" | "archived" }) {
  return (
    <span className={cn(
      "rounded-lg px-2 py-1 text-xs font-semibold",
      status === "active" ? "bg-success-subtle text-success-strong" : status === "archived" ? "bg-surface-sunken text-fg-muted" : "bg-info-subtle text-info-strong"
    )}>
      {statusLabel(status)}
    </span>
  );
}

export function StatusText({ active, activeText, inactiveText }: { active: boolean; activeText: string; inactiveText: string }) {
  return (
    <span className={cn(
      "rounded-lg px-2 py-1 text-xs font-semibold",
      active ? "bg-success-subtle text-success-strong" : "bg-surface-sunken text-fg-muted"
    )}>
      {active ? activeText : inactiveText}
    </span>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-1 text-xl font-semibold text-fg-strong">{value}</p>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-sm text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-300">
        <Layers3 className="h-8 w-8" />
      </div>
      <p className="mt-5 font-semibold text-fg-secondary">{title}</p>
      <p className="mt-2 text-sm leading-6 text-fg-subtle">{description}</p>
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
