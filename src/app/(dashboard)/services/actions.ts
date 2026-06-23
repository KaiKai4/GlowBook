"use server";

import { revalidatePath } from "next/cache";
import { archiveServiceCategory } from "@/features/services/use-cases/archive-category";
import { createServiceCategory } from "@/features/services/use-cases/create-category";
import { createCatalogService } from "@/features/services/use-cases/create-service";
import { updateServiceCategory } from "@/features/services/use-cases/update-category";
import { updateCatalogService } from "@/features/services/use-cases/update-service";
import {
  combineServiceDuration,
  isValidServiceDurationParts,
  type ServiceDurationParts,
} from "@/features/services/domain/duration";
import {
  CreateCategorySchema,
  CreateServiceSchema,
  UpdateCategorySchema,
  UpdateServiceSchema,
} from "@/features/services/schemas";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.SERVICES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar servicios." };
  }

  const limited = assertActionRateLimit(profile.id, "services", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;

  return { ok: true, value: { salonId: profile.salon_id } };
}

function readNumber(value: FormDataEntryValue | null): number {
  return typeof value === "string" && value.trim() !== "" ? Number(value) : 0;
}

function readServiceDuration(formData: FormData): Result<number> {
  const parts: ServiceDurationParts = {
    hours: readNumber(formData.get("duration_hours")),
    minutes: readNumber(formData.get("duration_minutes_part")),
  };

  if (!isValidServiceDurationParts(parts)) {
    return {
      ok: false,
      error: "Indica una duración valida: horas desde 0 y minutos entre 0 y 59.",
    };
  }

  return { ok: true, value: combineServiceDuration(parts) };
}

export async function createCategoryAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const parsed = CreateCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    ordering: Number(formData.get("ordering") ?? 0),
    pricing_mode: formData.get("pricing_mode") === "variable" ? "variable" : "fixed",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await createServiceCategory(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/services");
  return result;
}

export async function updateCategoryPricingModeAction(
  categoryId: string,
  pricingMode: "fixed" | "variable"
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const parsed = UpdateCategorySchema.safeParse({ pricing_mode: pricingMode });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await updateServiceCategory(categoryId, guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/services");
  return result;
}

export async function archiveCategoryAction(categoryId: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const result = await archiveServiceCategory(categoryId, guarded.value.salonId);
  if (result.ok) revalidatePath("/services");
  return result;
}

export async function createServiceAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  const moduleAccess = await checkPlanModuleAccess({ salonId: guarded.value.salonId, moduleKey: "services" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: guarded.value.salonId, metricKey: "services.active" });
  if (!limit.ok) return { ok: false, error: limit.error };
  const duration = readServiceDuration(formData);
  if (!duration.ok) return duration;

  const parsed = CreateServiceSchema.safeParse({
    category_id: formData.get("category_id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    duration_minutes: duration.value,
    price: Number(formData.get("price")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await createCatalogService(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/services");
  return result;
}

export async function updateServiceAction(
  serviceId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  const duration = readServiceDuration(formData);
  if (!duration.ok) return duration;

  const parsed = UpdateServiceSchema.safeParse({
    name: formData.get("name") ?? undefined,
    description: formData.get("description") ?? undefined,
    duration_minutes: duration.value,
    price: formData.get("price") ? Number(formData.get("price")) : undefined,
    is_active:
      formData.get("is_active") === "true"
        ? true
        : formData.get("is_active") === "false"
          ? false
          : undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await updateCatalogService(serviceId, guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/services");
  return result;
}
