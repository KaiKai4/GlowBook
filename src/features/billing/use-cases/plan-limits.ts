import "server-only";
import type { PlatformAdminProof } from "@/infra/auth/platform-admin-proof";
import { publishAuditEvent } from "@/features/audit";
import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import {
  hasOpenPlanAlert,
  recordPlanAlert,
  resolvePlanAlert,
} from "../data/salon-subscriptions.repo";
import { checkLimitAction } from "../domain/commercial-plan";
import type { PlanMetricKey } from "../domain/plan-keys";
import { planLimitMessage } from "../messages";
import { commercialPlanAudit } from "./billing-shared";
import { getEffectiveSalonPlan } from "./plan-modules";

/** Comprueba un límite del plan antes de una acción; registra alertas de aviso o bloqueo. */
export async function checkPlanLimit(input: {
  salonId: string;
  metricKey: PlanMetricKey;
  requestedAmount?: number;
}): Promise<Result<void>> {
  const plan = await getEffectiveSalonPlan(input.salonId);
  const limit = plan.limits.find((item) => item.metric.key === input.metricKey);
  // Un límite solo existe con plan activo (buildEffectiveLimits devuelve [] sin plan).
  const activePlan = plan.plan;
  if (!limit || !activePlan) return ok(undefined);

  const check = checkLimitAction({
    metricKey: input.metricKey,
    metricName: limit.metric.name,
    used: limit.used,
    requested: input.requestedAmount ?? 1,
    maxValue: limit.maxValue,
    enforcementMode: limit.enforcementMode,
  });

  if (!check.allowed) {
    const checkMessage = planLimitMessage(check.messageCode, {
      metricName: limit.metric.name,
      used: check.used,
      maxValue: check.maxValue,
    });
    await recordPlanAlertOnce({
      salonId: input.salonId,
      planId: activePlan.id,
      metricKey: input.metricKey,
      moduleKey: limit.metric.moduleKey,
      severity: "danger",
      message: checkMessage,
    });
    return err(checkMessage);
  }

  if (limit.warningLevel === "near_limit" || limit.warningLevel === "over_limit") {
    await recordPlanAlertOnce({
      salonId: input.salonId,
      planId: activePlan.id,
      metricKey: input.metricKey,
      moduleKey: limit.metric.moduleKey,
      severity: limit.warningLevel === "over_limit" ? "danger" : "warning",
      message: planLimitMessage(limit.messageCode, {
        metricName: limit.metric.name,
        used: limit.used,
        maxValue: limit.maxValue,
      }),
    });
  }

  return ok(undefined);
}

// Una alerta abierta por salon y límite: las acciones repetidas cerca del
// límite no deben inundar el panel de plataforma.
async function recordPlanAlertOnce(values: Parameters<typeof recordPlanAlert>[0] & { salonId: string }) {
  if (await hasOpenPlanAlert(values.salonId, values.metricKey)) return;
  await recordPlanAlert({
    planId: values.planId,
    metricKey: values.metricKey,
    moduleKey: values.moduleKey,
    severity: values.severity,
    message: values.message,
  });
}

export async function resolveSalonPlanAlertConfig(
  proof: PlatformAdminProof,
  alertId: string,
  salonId: string,
  actorUserId?: string | null
): Promise<Result<void>> {
  try {
    await resolvePlanAlert(proof, salonId, alertId);
    const warnings = await publishAuditEvent("billing.plan_alert_resolved", { ...commercialPlanAudit(actorUserId, salonId), action: "commercial_plan_alert_resolved" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo resolver la alerta."));
  }
}
