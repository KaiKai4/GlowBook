import type { PlanLimitCountScope } from "./commercial-plan";

/** Campos de la asignación que determinan la ventana de consumo. */
export interface UsageCycleAssignment {
  starts_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

// Las ventanas de ciclo se calculan aquí (logica de negocio con casos como el
// periodo pagado o el día ancla); la RPC count_salon_usage solo ejecuta todos
// los counts en un unico round-trip a la base.
export function scopeWindow(
  scope: PlanLimitCountScope,
  assignment: UsageCycleAssignment | null
): [string | null, string | null] {
  if (scope === "current" || scope === "lifetime") return [null, null];
  return scope === "billing_cycle" ? billingCycleWindow(assignment) : currentMonthWindow();
}

function currentMonthWindow(): [string, string] {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return [from.toISOString(), to.toISOString()];
}

function billingCycleWindow(assignment: UsageCycleAssignment | null): [string, string] {
  // El periodo pagado manda: si la plataforma registro un pago, el ciclo de
  // consumo corre exactamente con ese mes de uso.
  if (assignment?.current_period_start && assignment.current_period_end) {
    return [
      `${assignment.current_period_start}T00:00:00.000Z`,
      `${assignment.current_period_end}T00:00:00.000Z`,
    ];
  }
  return anchoredCycleWindow(assignment?.starts_at ?? null);
}

function anchoredCycleWindow(startsAt: string | null): [string, string] {
  if (!startsAt) return currentMonthWindow();

  const now = new Date();
  const anchor = new Date(`${startsAt}T00:00:00.000Z`);
  const cycleDay = anchor.getUTCDate();
  let from = clampedUtcDate(now.getUTCFullYear(), now.getUTCMonth(), cycleDay);

  if (from.getTime() > now.getTime()) {
    from = clampedUtcDate(now.getUTCFullYear(), now.getUTCMonth() - 1, cycleDay);
  }

  const to = clampedUtcDate(from.getUTCFullYear(), from.getUTCMonth() + 1, cycleDay);
  return [from.toISOString(), to.toISOString()];
}

function clampedUtcDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}
