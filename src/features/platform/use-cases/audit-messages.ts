import { PLATFORM_AUDIT_ACTIONS, type PlatformAuditAction } from "@/features/audit";

// Texto visible de cada accion de auditoria. La presentacion deriva el texto de
// la accion (clave tipada), nunca de la metadata: la metadata guarda solo datos
// estructurados y las filas antiguas que traigan texto alli no cambian el titulo.
const AUDIT_ACTION_TEXT: Record<PlatformAuditAction, string> = {
  invite_salon: "Invitar Salon",
  regenerate_salon_invitation: "Regenerar enlace de invitacion",
  set_salon_status: "Actualizar estado de Salon",
  update_salon_features: "Actualizar funciones",
  delete_salon: "Eliminar Salon",
  set_feedback_status: "Moderar reporte",
  billing_feature_saved: "Guardar capacidad de plan",
  billing_plan_created: "Crear plan",
  billing_entitlement_saved: "Guardar límite de plan",
  billing_plan_assigned: "Asignar plan a Salon",
  billing_override_saved: "Guardar extra de Salon",
  commercial_module_saved: "Guardar modulo comercial",
  commercial_plan_saved: "Guardar plan comercial",
  commercial_plan_archived: "Archivar plan comercial",
  commercial_plan_deleted: "Eliminar plan comercial",
  commercial_plan_module_saved: "Guardar modulo de plan",
  commercial_limit_metric_saved: "Guardar metrica de límite",
  commercial_plan_limit_saved: "Guardar límite de plan",
  commercial_plan_assigned: "Asignar plan comercial",
  commercial_plan_override_saved: "Guardar extra comercial",
  commercial_addon_saved: "Guardar extra del catalogo",
  commercial_addon_archived: "Archivar extra del catalogo",
  commercial_addon_deleted: "Eliminar extra del catalogo",
  commercial_plan_extra_assigned: "Asignar extra a Salon",
  commercial_plan_extra_canceled: "Cancelar extra de Salon",
  commercial_plan_payment_recorded: "Registrar pago de Salon",
  commercial_plan_alert_resolved: "Resolver alerta de límite",
  invitation_accepted: "Invitacion aceptada",
};

const UNKNOWN_AUDIT_ACTION_TEXT = "Acción no reconocida";

export function isKnownAuditAction(value: string): value is PlatformAuditAction {
  // Object.hasOwn: "toString" u otras claves del prototipo no son acciones válidas.
  return Object.hasOwn(AUDIT_ACTION_TEXT, value);
}

/** Texto para una accion; cualquier valor desconocido recibe un texto generico. */
export function auditActionText(action: string): string {
  return isKnownAuditAction(action) ? AUDIT_ACTION_TEXT[action] : UNKNOWN_AUDIT_ACTION_TEXT;
}

/** Opciones del filtro por accion, en el orden del catalogo. */
export function auditActionOptions(): Array<{ value: PlatformAuditAction; label: string }> {
  return PLATFORM_AUDIT_ACTIONS.map((value) => ({ value, label: AUDIT_ACTION_TEXT[value] }));
}
