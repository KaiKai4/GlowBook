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
