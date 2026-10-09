import "server-only";

/** Datos comunes de auditoria de un plan comercial; el caso de uso añade su accion y su evento. */
export function commercialPlanAudit(actorUserId: string | null | undefined, targetResourceId: string) {
  return {
    actorUserId: actorUserId ?? null,
    status: "succeeded" as const,
    targetResourceType: "commercial_plan",
    targetResourceId,
  };
}

export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dateOrNull(value?: string | null) {
  return value && value.trim() ? value : null;
}
