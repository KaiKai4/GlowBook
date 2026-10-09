"use server";

import { revalidatePath } from "next/cache";
import { RetailSaleSchema } from "@/features/retail/schemas";
import { createRetailSale } from "@/features/retail/use-cases/retail-sales";
import { assertSalonPaymentMethodEnabled } from "@/features/salon/use-cases/salon-payment-methods";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import type { Result } from "@/lib/result";
import { firstIssueMessage } from "@/lib/validation/first-issue";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.RETAIL_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar vitrina." };
  }

  const limited = await assertActionRateLimit(profile.id, "retail", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;
  return { ok: true, value: { salonId: profile.salon_id } };
}

export async function createRetailSaleAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  const moduleAccess = await checkPlanModuleAccess({ salonId: guarded.value.salonId, moduleKey: "retail" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: guarded.value.salonId, metricKey: "retail.sales" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const parsed = RetailSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const paymentEnabled = await assertSalonPaymentMethodEnabled(
    guarded.value.salonId,
    parsed.data.payment_method
  );
  if (!paymentEnabled) {
    return { ok: false, error: "Ese metodo de pago no esta habilitado para este salon." };
  }

  const result = await createRetailSale(
    guarded.value.salonId,
    parsed.data,
    parsed.data.idempotency_key
  );
  if (result.ok) {
    revalidatePath("/retail");
    revalidatePath("/inventory");
    revalidatePath("/reports");
  }
  return result;
}
