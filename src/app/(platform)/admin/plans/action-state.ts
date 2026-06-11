export interface PlatformPlanActionState {
  ok: boolean;
  message: string;
}

export const PLATFORM_PLAN_IDLE_STATE: PlatformPlanActionState = {
  ok: false,
  message: "",
};
