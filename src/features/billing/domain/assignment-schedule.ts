import type { SalonPlanAssignmentStatus } from "./commercial-plan";

export interface AssignmentScheduleInput {
  status: SalonPlanAssignmentStatus;
  trialDays: number;
  /** Fecha de referencia (hoy) en formato YYYY-MM-DD. */
  today: string;
  /** Inicio ya existente, si el salon ya tenia el plan asignado. */
  existingStartsAt?: string | null;
}

export interface AssignmentSchedule {
  startsAt: string;
  trialEndsAt: string | null;
}

/**
 * Deriva las fechas de una suscripcion a partir del plan y el estado.
 * Los planes son mensuales y se renuevan solos, por eso no se calcula un
 * "fin de ciclo": solo el inicio y, cuando aplica, el fin del trial.
 *
 * - startsAt: se conserva el inicio existente; si no hay, es hoy.
 * - trialEndsAt: inicio + trialDays, solo cuando el estado es "trialing"
 *   y el plan ofrece días de prueba. En cualquier otro estado es null.
 */
export function deriveAssignmentSchedule(input: AssignmentScheduleInput): AssignmentSchedule {
  const startsAt = input.existingStartsAt?.trim() || input.today;

  if (input.status !== "trialing" || input.trialDays <= 0) {
    return { startsAt, trialEndsAt: null };
  }

  return { startsAt, trialEndsAt: addDays(startsAt, input.trialDays) };
}

export interface PaymentPeriodInput {
  /** Fecha en que se registro el pago (YYYY-MM-DD). */
  paidAt: string;
  /** Fin del periodo pagado vigente, si existe. */
  currentPeriodEnd?: string | null;
}

export interface PaymentPeriod {
  periodStart: string;
  periodEnd: string;
}

/**
 * Deriva el mes de uso que cubre un pago.
 * Si el salon todavia tiene periodo vigente (pago por adelantado), el nuevo
 * mes encadena al final del periodo actual; si ya vencio o nunca pago,
 * el mes corre desde la fecha del pago.
 */
export function derivePaymentPeriod(input: PaymentPeriodInput): PaymentPeriod {
  const current = input.currentPeriodEnd?.trim() || null;
  const periodStart = current && current >= input.paidAt ? current : input.paidAt;
  return { periodStart, periodEnd: addMonths(periodStart, 1) };
}

export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function addMonths(isoDate: string, months: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  const day = base.getUTCDate();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function todayIso(reference: Date = new Date()): string {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}
