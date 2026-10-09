import Link from "next/link";
import { History, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import type { PlatformAuditLogViewModel } from "@/features/platform/use-cases/get-platform-audit-log";
import { getPlatformAuditLog } from "@/features/platform/use-cases/get-platform-audit-log";
import { AuditTable } from "./audit-table";

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
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <History className="h-6 w-6 text-accent" aria-hidden="true" />
            Auditoria de Plataforma
          </span>
        }
        description={
          <>
            Acciones administrativas cross-tenant registradas por el Module de Plataforma.
            {view.failedCount > 0 && (
              <span className="ml-1 font-semibold text-danger">
                {view.failedCount} fallida{view.failedCount === 1 ? "" : "s"}
              </span>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-fg-muted">
            <ShieldCheck className="h-4 w-4 text-success-fg" aria-hidden="true" />
            {view.totalVisible} evento{view.totalVisible === 1 ? "" : "s"}
          </div>
        }
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {view.statuses.map((status) => (
            <Link
              key={status.value}
              href={filterHref({ action: view.action, status: status.value })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                view.status === status.value
                  ? "border-fg bg-fg text-surface"
                  : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
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
                  ? "border-accent bg-accent-subtle text-accent-strong"
                  : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
              }`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {view.entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <p className="text-sm text-fg-subtle">No hay eventos de auditoria para estos filtros.</p>
        </div>
      ) : (
        <AuditTable key={`${view.action}:${view.status}`} entries={view.entries} />
      )}
    </div>
  );
}
