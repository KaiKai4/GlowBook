"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  createCategory,
  createService,
  updateService,
} from "@/features/services/data/services.repo";
import {
  CreateCategorySchema,
  CreateServiceSchema,
  UpdateServiceSchema,
} from "@/features/services/schemas";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.SERVICES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar servicios." };
  }
  return { ok: true, value: { salonId: profile.salon_id } };
}

export async function createCategoryAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const g = await guard();
  if (!g.ok) return g;

  const parsed = CreateCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    ordering: Number(formData.get("ordering") ?? 0),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const cat = await createCategory(g.value.salonId, parsed.data);
    revalidatePath("/services");
    return { ok: true, value: cat.id };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("unique")) return { ok: false, error: "Ya existe una categoría con ese nombre." };
    return { ok: false, error: "Error al crear la categoría." };
  }
}

export async function createServiceAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const g = await guard();
  if (!g.ok) return g;

  const parsed = CreateServiceSchema.safeParse({
    category_id: formData.get("category_id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    duration_minutes: Number(formData.get("duration_minutes")),
    price: Number(formData.get("price")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const svc = await createService(g.value.salonId, parsed.data);
    revalidatePath("/services");
    return { ok: true, value: svc.id };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("unique")) return { ok: false, error: "Ya existe un servicio con ese nombre." };
    return { ok: false, error: "Error al crear el servicio." };
  }
}

export async function updateServiceAction(
  serviceId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  const parsed = UpdateServiceSchema.safeParse({
    name: formData.get("name") ?? undefined,
    description: formData.get("description") ?? undefined,
    duration_minutes: formData.get("duration_minutes") ? Number(formData.get("duration_minutes")) : undefined,
    price: formData.get("price") ? Number(formData.get("price")) : undefined,
    is_active: formData.get("is_active") === "true" ? true : formData.get("is_active") === "false" ? false : undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await updateService(serviceId, g.value.salonId, parsed.data);
    revalidatePath("/services");
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[services]", err);
    return { ok: false, error: "Error al actualizar el servicio." };
  }
}
