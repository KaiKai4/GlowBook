import { captureError } from "@/infra/observability";
import type { EffectiveSalonPlan } from "../domain/commercial-plan";

/**
 * Lee el plan efectivo para decisiones de visibilidad. Si la lectura falla se
 * registra el error (con el contexto de la accion) y se devuelve null: el
 * llamador aplica entonces el fallback heredado de features del salon.
 */
export async function readEffectivePlanOrNull(
  salonId: string,
  action: string,
  load: (salonId: string) => Promise<EffectiveSalonPlan>
): Promise<EffectiveSalonPlan | null> {
  try {
    return await load(salonId);
  } catch (error) {
    captureError(error, { module: "billing", action, metadata: { effect: "plan efectivo" } });
    return null;
  }
}
