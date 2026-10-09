import type { Result } from "@/infra/result";

export interface PlatformPlanActionState {
  ok: boolean;
  message: string;
  /** La operación se confirmó, pero un efecto posterior (p. ej. la auditoría) falló. */
  warnings?: string[];
}

export const PLATFORM_PLAN_IDLE_STATE: PlatformPlanActionState = {
  ok: false,
  message: "",
};

/**
 * Traduce el resultado del pipeline al estado del formulario: el mensaje de
 * exito viaja como valor y los avisos solo llegan si el caso de uso los emitio.
 */
export function toPlanActionState(result: Result<string>): PlatformPlanActionState {
  if (!result.ok) return { ok: false, message: result.error };
  return result.warnings
    ? { ok: true, message: result.value, warnings: result.warnings }
    : { ok: true, message: result.value };
}
