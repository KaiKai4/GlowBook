import Link from "next/link";
import { AlertTriangle, Clock, History, ShieldCheck, UserRound } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
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

const AUDIT_COLUMNS: DataTableColumn<PlatformAuditLogEntryViewModel>[] = [
  {
    id: "action",
    header: "Accion",
    cell: (entry) => (
      <div>
        <p className="font-semibold text-fg">{entry.actionLabel}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-fg-subtle">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {entry.createdAtLabel}
        </p>
      </div>
    ),
  },
  {
    id: "status",
    header: "Estado",
    cell: (entry) => (
      <div>
        <StatusBadge variant={statusVariant(entry.status)} label={entry.statusLabel} />
        {entry.errorMessage && (
          <p className="mt-2 flex items-start gap-1 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {entry.errorMessage}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "actor",
    header: "Actor",
    secondary: true,
    cell: (entry) => (
      <div className="flex items-start gap-1.5 text-fg-muted">
        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
        <span>{entry.actorLabel}</span>
      </div>
    ),
  },
  {
    id: "target",
    header: "Objetivo",
    secondary: true,
    cell: (entry) => <div className="font-mono text-xs text-fg-subtle">{entry.targetLabel}</div>,
  },
  {
    id: "detail",
    header: "Detalle",
    cell: (entry) =>
      entry.metadata.length === 0 ? (
        <p className="text-xs text-fg-subtle">Sin metadata.</p>
      ) : (
        <dl className="space-y-1">
          {entry.metadata.map((item) => (
            <div key={item.key} className="flex flex-wrap gap-1 text-xs">
              <dt className="font-medium text-fg-subtle">{item.key}:</dt>
              <dd className="text-fg-secondary">{item.value}</dd>
            </div>
          ))}
        </dl>
      ),
  },
];

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
        <DataTable
          key={`${view.action}:${view.status}`}
          label="Eventos de auditoría"
          columns={AUDIT_COLUMNS}
          rows={view.entries}
          getRowId={(entry) => entry.id}
          emptyMessage="No hay eventos de auditoria para estos filtros."
        />
      )}
    </div>
  );
}
