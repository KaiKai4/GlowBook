import { runSideEffect } from "@/lib/effects/run-side-effect";
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
  const outcome = await runSideEffect("plan efectivo", () => load(salonId), {
    module: "billing",
    action,
  });
  return outcome.ok ? outcome.value : null;
}
