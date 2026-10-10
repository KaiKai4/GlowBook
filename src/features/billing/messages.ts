import type { PlanLimitMessageCode } from "./domain/commercial-plan";

// Textos visibles de billing. El dominio devuelve códigos (PlanLimitMessageCode);
// la traducción a español vive aquí, fuera de domain/.

/** Texto de un aviso de límite del plan. Vacío si no hay aviso que mostrar. */
export function planLimitMessage(
  code: PlanLimitMessageCode | null,
  input: { metricName: string; used: number; maxValue: number | null }
): string {
  const { metricName, used, maxValue } = input;
  if (code === null || maxValue === null) return "";
  switch (code) {
    case "near_limit":
      return `${metricName}: vas ${used} de ${maxValue} en tu plan.`;
    case "exceeded":
      return `${metricName}: superaste el límite de tu plan (${used} de ${maxValue}).`;
    case "reached":
      return `${metricName}: alcanzaste el límite de tu plan (${used} de ${maxValue}).`;
    case "action_blocked":
      return `${metricName} alcanzo el límite del plan (${maxValue}).`;
  }
}
