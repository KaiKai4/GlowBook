"use server";

import { revalidatePath } from "next/cache";
import { updateBusinessHours } from "@/features/salon/use-cases/update-business-hours";
import { updateSalonBackground } from "@/features/salon/use-cases/update-salon-background";
import { updateSalonInfo } from "@/features/salon/use-cases/update-salon-info";
import { updateSalonPaymentMethods } from "@/features/salon/use-cases/update-salon-payment-methods";
import { updateSalonTheme } from "@/features/salon/use-cases/update-salon-theme";
import {
  BusinessHoursSchema,
  SalonInfoSchema,
  SalonPaymentMethodsSchema,
} from "@/features/salon/schemas";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import type { Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.SALON_MANAGE)) {
    return { ok: false, error: "No tienes permiso para editar el salon." };
  }

  const limited = await assertActionRateLimit(profile.id, "salon", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;

  return { ok: true, value: { salonId: profile.salon_id } };
}

export async function updateSalonInfoAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const parsed = SalonInfoSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await updateSalonInfo(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateSalonThemeAction(theme: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const result = await updateSalonTheme(guarded.value.salonId, theme);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateSalonBgAction(bgStyle: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const result = await updateSalonBackground(guarded.value.salonId, bgStyle);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateBusinessHoursAction(hoursJson: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  let raw: unknown;
  try {
    raw = JSON.parse(hoursJson);
  } catch {
    return { ok: false, error: "Datos de horario invalidos." };
  }

  const parsed = BusinessHoursSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await updateBusinessHours(guarded.value.salonId, parsed.data);
  if (result.ok) {
    revalidatePath("/salon");
    revalidatePath("/appointments");
    revalidatePath("/appointments/new");
  }

  return result;
}

export async function updateSalonPaymentMethodsAction(
  paymentMethods: string[]
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const parsed = SalonPaymentMethodsSchema.safeParse(paymentMethods);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await updateSalonPaymentMethods(guarded.value.salonId, parsed.data);
  if (result.ok) {
    revalidatePath("/salon");
    revalidatePath("/appointments");
    revalidatePath("/retail");
  }

  return result;
}
