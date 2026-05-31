import "server-only";

import {
  findPlatformAuditLog,
  type PlatformAuditAction,
  type PlatformAuditRow,
  type PlatformAuditStatus,
} from "@/features/platform/data/platform-audit.repo";
import type { Json } from "@/types/database.types";

const ACTION_LABELS: Record<PlatformAuditAction, string> = {
  invite_salon: "Invitar Salon",
  set_salon_status: "Actualizar estado de Salon",
  update_salon_features: "Actualizar funciones",
  delete_salon: "Eliminar Salon",
  set_feedback_status: "Moderar reporte",
};

const STATUS_LABELS: Record<PlatformAuditStatus, string> = {
  succeeded: "Correcta",
  failed: "Fallida",
};

export interface PlatformAuditLogFilter {
  action?: string;
  status?: string;
}

export interface PlatformAuditMetadataItem {
  key: string;
  value: string;
}

export interface PlatformAuditLogEntryViewModel {
  id: string;
  action: PlatformAuditAction;
  actionLabel: string;
  status: PlatformAuditStatus;
  statusLabel: string;
  actorLabel: string;
  targetLabel: string;
  metadata: PlatformAuditMetadataItem[];
  errorMessage: string | null;
  createdAtLabel: string;
}

export interface PlatformAuditLogViewModel {
  entries: PlatformAuditLogEntryViewModel[];
  action: PlatformAuditAction | "all";
  status: PlatformAuditStatus | "all";
  totalVisible: number;
  failedCount: number;
  actions: Array<{ value: PlatformAuditAction | "all"; label: string }>;
  statuses: Array<{ value: PlatformAuditStatus | "all"; label: string }>;
}

function isAuditAction(value: string | undefined): value is PlatformAuditAction {
  return Boolean(value && value in ACTION_LABELS);
}

function isAuditStatus(value: string | undefined): value is PlatformAuditStatus {
  return value === "succeeded" || value === "failed";
}

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleString("es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function stringifyMetadataValue(value: Json): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => stringifyMetadataValue(item)).join(", ");
  return JSON.stringify(value);
}

function metadataItems(metadata: Json): PlatformAuditMetadataItem[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];

  return Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      key,
      value: stringifyMetadataValue(value as Json),
    }));
}

function targetLabel(entry: PlatformAuditRow): string {
  if (entry.target_salon_id) return `Salon ${shortId(entry.target_salon_id)}`;
  if (entry.target_resource_type && entry.target_resource_id) {
    return `${entry.target_resource_type} ${shortId(entry.target_resource_id)}`;
  }
  if (entry.target_resource_type) return entry.target_resource_type;
  return "Sin objetivo";
}

function toViewModel(entry: PlatformAuditRow): PlatformAuditLogEntryViewModel {
  const action = entry.action as PlatformAuditAction;
  const status = entry.status as PlatformAuditStatus;

  return {
    id: entry.id,
    action,
    actionLabel: ACTION_LABELS[action] ?? entry.action,
    status,
    statusLabel: STATUS_LABELS[status] ?? entry.status,
    actorLabel: entry.actor_user_id ? `Admin ${shortId(entry.actor_user_id)}` : "Admin eliminado",
    targetLabel: targetLabel(entry),
    metadata: metadataItems(entry.metadata),
    errorMessage: entry.error_message,
    createdAtLabel: formatCreatedAt(entry.created_at),
  };
}

export async function getPlatformAuditLog({
  action,
  status,
}: PlatformAuditLogFilter = {}): Promise<PlatformAuditLogViewModel> {
  const parsedAction = isAuditAction(action) ? action : undefined;
  const parsedStatus = isAuditStatus(status) ? status : undefined;
  const entries = (await findPlatformAuditLog({
    action: parsedAction,
    status: parsedStatus,
    limit: 100,
  })).map(toViewModel);

  return {
    entries,
    action: parsedAction ?? "all",
    status: parsedStatus ?? "all",
    totalVisible: entries.length,
    failedCount: entries.filter((entry) => entry.status === "failed").length,
    actions: [
      { value: "all", label: "Todas" },
      ...Object.entries(ACTION_LABELS).map(([value, label]) => ({
        value: value as PlatformAuditAction,
        label,
      })),
    ],
    statuses: [
      { value: "all", label: "Todos" },
      { value: "succeeded", label: STATUS_LABELS.succeeded },
      { value: "failed", label: STATUS_LABELS.failed },
    ],
  };
}
