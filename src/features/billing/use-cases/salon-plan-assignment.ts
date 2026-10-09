import "server-only";
import { toPublicErrorMessage } from "@/lib/errors";
import { z } from "@/lib/validation/zod";
import { err, ok, type Result } from "@/lib/result";
import { firstIssueMessage } from "@/lib/validation/first-issue";
import {
  deriveAssignmentSchedule,
  derivePaymentPeriod,
  todayIso,
} from "../domain/assignment-schedule";
import { findPlanWithChildren } from "../data/commercial-plans.repo";
import {
  activatePaidPeriod,
  assignSalonPlan,
  findAssignmentForPayment,
  findAssignmentStartsAt,
  recordSalonPlanPayment,
} from "../data/salon-subscriptions.repo";
import { commercialPlanAudit, dateOrNull } from "./billing-shared";
import { publishAuditEvent } from "@/features/audit";

const AssignmentSchema = z.object({
  salonId: z.string().uuid("Selecciona un salon."),
  planId: z.string().uuid("Selecciona un plan."),
  status: z.enum(["trialing", "active", "past_due", "paused", "canceled"]).default("trialing"),
  // Inicio y fin del trial se derivan del plan; no se piden al usuario.
  // Solo fin (suspension programada) es opcional y manual.
  endsAt: z.string().trim().optional(),
  notes: z.string().trim().max(400).default(""),
});

const PaymentSchema = z.object({
  salonId: z.string().uuid("Selecciona un salon."),
  amount: z.coerce.number().min(0, "El monto no puede ser negativo."),
  paidAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de pago inválida.")
    .optional(),
  notes: z.string().trim().max(400).default(""),
});

export async function assignSalonCommercialPlanConfig(
  input: z.input<typeof AssignmentSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = AssignmentSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  try {
    const [plan, existingStartsAt] = await Promise.all([
      findPlanWithChildren(parsed.data.planId),
      findAssignmentStartsAt(parsed.data.salonId),
    ]);
    if (!plan) return err("El plan seleccionado no existe.");

    const schedule = deriveAssignmentSchedule({
      status: parsed.data.status,
      trialDays: plan.trialDays,
      today: todayIso(),
      existingStartsAt,
    });

    await assignSalonPlan({
      salonId: parsed.data.salonId,
      planId: parsed.data.planId,
      status: parsed.data.status,
      startsAt: schedule.startsAt,
      endsAt: dateOrNull(parsed.data.endsAt),
      trialEndsAt: schedule.trialEndsAt,
      notes: parsed.data.notes,
    });
    const warnings = await publishAuditEvent("billing.plan_assigned", { ...commercialPlanAudit(actorUserId, parsed.data.salonId), action: "commercial_plan_assigned" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo asignar el plan."));
  }
}

/**
 * Asigna el plan elegido en la invitacion apenas el salon se crea.
 * Asi el salon nace con sus modulos y límites correctos y nunca ve
 * funcionalidades que su plan no incluye.
 */
export async function autoAssignPlanOnAcceptance(input: {
  salonId: string;
  planId: string;
  acceptedByUserId: string;
}): Promise<Result<void>> {
  try {
    const plan = await findPlanWithChildren(input.planId);
    if (!plan) return err("El plan de la invitacion ya no existe.");

    const status = plan.trialDays > 0 ? "trialing" : "active";
    const schedule = deriveAssignmentSchedule({
      status,
      trialDays: plan.trialDays,
      today: todayIso(),
      existingStartsAt: null,
    });

    await assignSalonPlan({
      salonId: input.salonId,
      planId: input.planId,
      status,
      startsAt: schedule.startsAt,
      endsAt: null,
      trialEndsAt: schedule.trialEndsAt,
      notes: "Asignado automaticamente al aceptar la invitacion.",
    });
    const warnings = await publishAuditEvent("billing.plan_assigned", { ...commercialPlanAudit(input.acceptedByUserId, input.salonId), action: "commercial_plan_assigned" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo asignar el plan de la invitacion."));
  }
}

/**
 * Registra que el salon pago su mensualidad: guarda el pago en el historial,
 * activa la suscripcion y fija el mes de uso (periodo) que cubre ese pago.
 */
export async function registerSalonPlanPaymentConfig(
  input: z.input<typeof PaymentSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = PaymentSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  try {
    const assignment = await findAssignmentForPayment(parsed.data.salonId);
    if (!assignment) return err("Este salon no tiene plan asignado. Asignale un plan primero.");

    const plan = await findPlanWithChildren(assignment.plan_id);
    const paidAt = parsed.data.paidAt || todayIso();
    const period = derivePaymentPeriod({
      paidAt,
      currentPeriodEnd: assignment.current_period_end,
    });

    await recordSalonPlanPayment({
      salonId: parsed.data.salonId,
      planId: assignment.plan_id,
      amount: parsed.data.amount,
      currency: plan?.currency ?? "USD",
      paidAt,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      notes: parsed.data.notes,
    });
    await activatePaidPeriod({
      salonId: parsed.data.salonId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    });
    const warnings = await publishAuditEvent("billing.payment_registered", { ...commercialPlanAudit(actorUserId, parsed.data.salonId), action: "commercial_plan_payment_recorded" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo registrar el pago."));
  }
}
