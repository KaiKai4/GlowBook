import "server-only";

import type { PlatformAuditAction, PlatformAuditStatus } from "@/features/audit";
import { findPlatformAuditLog, type PlatformAuditRow } from "@/features/platform/data/platform-audit.repo";
import { formatShortDateTime } from "@/infra/format/dates";
import type { Json } from "@/types/database.types";
import { auditActionOptions, auditActionText, isKnownAuditAction } from "./audit-messages";

/** Entradas de auditoría por página en la vista de plataforma. */
const AUDIT_LOG_PAGE_SIZE = 100;

const STATUS_LABELS: Record<PlatformAuditStatus, string> = {
  succeeded: "Correcta",
  failed: "Fallida",
};

export interface PlatformAuditLogFilter {
  action?: string;
  status?: string;
}

interface PlatformAuditMetadataItem {
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

/** Etiqueta propia del mapa; si no existe, el valor crudo (sin claves heredadas). */
function lookupLabel(labels: Record<string, string>, key: string): string {
  return Object.hasOwn(labels, key) ? (labels[key] ?? key) : key;
}

function isAuditAction(value: string | undefined): value is PlatformAuditAction {
  return value !== undefined && isKnownAuditAction(value);
}

function isAuditStatus(value: string | undefined): value is PlatformAuditStatus {
  return value === "succeeded" || value === "failed";
}

function formatCreatedAt(value: string): string {
  return formatShortDateTime(new Date(value));
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
  if (entry.target_salon_id) return `Salón ${shortId(entry.target_salon_id)}`;
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
    actionLabel: auditActionText(entry.action),
    status,
    statusLabel: lookupLabel(STATUS_LABELS, entry.status),
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
    limit: AUDIT_LOG_PAGE_SIZE,
  })).map(toViewModel);

  return {
    entries,
    action: parsedAction ?? "all",
    status: parsedStatus ?? "all",
    totalVisible: entries.length,
    failedCount: entries.filter((entry) => entry.status === "failed").length,
    actions: [
      { value: "all", label: "Todas" },
      ...auditActionOptions(),
    ],
    statuses: [
      { value: "all", label: "Todos" },
      { value: "succeeded", label: STATUS_LABELS.succeeded },
      { value: "failed", label: STATUS_LABELS.failed },
    ],
  };
}
