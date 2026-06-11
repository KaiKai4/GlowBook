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
  billing_feature_saved: "Guardar capacidad de plan",
  billing_plan_created: "Crear plan",
  billing_entitlement_saved: "Guardar limite de plan",
  billing_plan_assigned: "Asignar plan a Salon",
  billing_override_saved: "Guardar extra de Salon",
  commercial_module_saved: "Guardar modulo comercial",
  commercial_plan_saved: "Guardar plan comercial",
  commercial_plan_archived: "Archivar plan comercial",
  commercial_plan_deleted: "Eliminar plan comercial",
  commercial_plan_module_saved: "Guardar modulo de plan",
  commercial_limit_metric_saved: "Guardar metrica de limite",
  commercial_plan_limit_saved: "Guardar limite de plan",
  commercial_plan_assigned: "Asignar plan comercial",
  commercial_plan_override_saved: "Guardar extra comercial",
  commercial_addon_saved: "Guardar extra del catalogo",
  commercial_addon_archived: "Archivar extra del catalogo",
  commercial_addon_deleted: "Eliminar extra del catalogo",
  commercial_plan_extra_assigned: "Asignar extra a Salon",
  commercial_plan_extra_canceled: "Cancelar extra de Salon",
  commercial_plan_payment_recorded: "Registrar pago de Salon",
  commercial_plan_alert_resolved: "Resolver alerta de limite",
  invitation_accepted: "Invitacion aceptada",
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
