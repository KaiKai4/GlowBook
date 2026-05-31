import Link from "next/link";
import { AlertTriangle, Clock, History, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type {
  PlatformAuditLogEntryViewModel,
  PlatformAuditLogViewModel,
} from "@/features/platform/use-cases/get-platform-audit-log";
import { getPlatformAuditLog } from "@/features/platform/use-cases/get-platform-audit-log";

function statusVariant(status: PlatformAuditLogEntryViewModel["status"]) {
  return status === "failed" ? "danger" : "success";
}

function filterHref({
  action,
  status,
}: {
  action: PlatformAuditLogViewModel["action"];
  status: PlatformAuditLogViewModel["status"];
}) {
  const params = new URLSearchParams();
  if (action !== "all") params.set("action", action);
  if (status !== "all") params.set("status", status);
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; status?: string }>;
}) {
  await requirePlatformAdmin();
  const filters = await searchParams;
  const view = await getPlatformAuditLog(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900">
            <History className="h-6 w-6 text-rose-500" />
            Auditoria de Plataforma
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Acciones administrativas cross-tenant registradas por el Module de Plataforma.
            {view.failedCount > 0 && (
              <span className="ml-1 font-semibold text-red-600">
                {view.failedCount} fallida{view.failedCount === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {view.totalVisible} evento{view.totalVisible === 1 ? "" : "s"}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {view.statuses.map((status) => (
            <Link
              key={status.value}
              href={filterHref({ action: view.action, status: status.value })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                view.status === status.value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
              }`}
            >
              {status.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {view.actions.map((action) => (
            <Link
              key={action.value}
              href={filterHref({ action: action.value, status: view.status })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                view.action === action.value
                  ? "border-rose-600 bg-rose-50 text-rose-700"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
              }`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {view.entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
          <p className="text-sm text-neutral-400">No hay eventos de auditoria para estos filtros.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.1fr_0.8fr_1fr_1fr_1.3fr] gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-400 lg:grid">
            <span>Accion</span>
            <span>Estado</span>
            <span>Actor</span>
            <span>Objetivo</span>
            <span>Detalle</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {view.entries.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.1fr_0.8fr_1fr_1fr_1.3fr]"
              >
                <div>
                  <p className="font-semibold text-neutral-900">{entry.actionLabel}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                    <Clock className="h-3.5 w-3.5" />
                    {entry.createdAtLabel}
                  </p>
                </div>
                <div>
                  <Badge variant={statusVariant(entry.status)}>{entry.statusLabel}</Badge>
                  {entry.errorMessage && (
                    <p className="mt-2 flex items-start gap-1 text-xs text-red-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {entry.errorMessage}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-1.5 text-neutral-600">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <span>{entry.actorLabel}</span>
                </div>
                <div className="font-mono text-xs text-neutral-500">{entry.targetLabel}</div>
                <div>
                  {entry.metadata.length === 0 ? (
                    <p className="text-xs text-neutral-400">Sin metadata.</p>
                  ) : (
                    <dl className="space-y-1">
                      {entry.metadata.map((item) => (
                        <div key={item.key} className="flex flex-wrap gap-1 text-xs">
                          <dt className="font-medium text-neutral-500">{item.key}:</dt>
                          <dd className="text-neutral-700">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
