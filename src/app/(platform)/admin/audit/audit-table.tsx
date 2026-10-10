"use client";

import { AlertTriangle, Clock, UserRound } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PlatformAuditLogEntryViewModel } from "@/features/platform/use-cases/get-platform-audit-log";

function statusVariant(status: PlatformAuditLogEntryViewModel["status"]) {
  return status === "failed" ? "danger" : "success";
}

const AUDIT_COLUMNS: DataTableColumn<PlatformAuditLogEntryViewModel>[] = [
  {
    id: "action",
    header: "Acción",
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

export function AuditTable({ entries }: { entries: PlatformAuditLogEntryViewModel[] }) {
  return (
    <DataTable
      label="Eventos de auditoría"
      columns={AUDIT_COLUMNS}
      rows={entries}
      getRowId={(entry) => entry.id}
      emptyMessage="No hay eventos de auditoria para estos filtros."
    />
  );
}
