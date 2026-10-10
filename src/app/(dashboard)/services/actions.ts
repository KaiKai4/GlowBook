"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import { archiveServiceCategory } from "@/features/services/use-cases/archive-category";
import { createServiceCategory } from "@/features/services/use-cases/create-category";
import {
  createServiceWithPlan,
  type ServicePlanGate,
} from "@/features/services/use-cases/create-service-with-plan";
import { updateServiceCategory } from "@/features/services/use-cases/update-category";
import { updateCatalogService } from "@/features/services/use-cases/update-service";
import {
  parseCategoryPricingInput,
  parseCreateCategoryInput,
  parseIdentifier,
  parseUpdateServiceInput,
  type CreateCategoryFields,
  type CreateCategoryRaw,
  type CreateServiceRaw,
  type PricingMode,
  type UpdateServiceRaw,
} from "@/features/services/use-cases/service-input";
import type { ServiceDurationParts } from "@/features/services/domain/duration";
import type { UpdateCategoryInput, UpdateServiceInput } from "@/features/services/schemas";
import { ok, type Result } from "@/infra/result";

// Las acciones solo adaptan el formulario y pasan por el pipeline de defineAction.
// La validacion y las reglas viven en src/features/services/use-cases.

const PERMISSION = {
  key: PERMISSIONS.SERVICES_MANAGE,
  deniedMessage: "No tienes permiso para gestionar servicios.",
};
const RATE_LIMIT = { scope: "services", options: RATE_LIMIT_POLICIES.write };
const revalidateServices = (): readonly string[] => ["/services"];

const servicePlanGate: ServicePlanGate = {
  checkModuleAccess: (salonId) => checkPlanModuleAccess({ salonId, moduleKey: "services" }),
  checkServiceLimit: (salonId) => checkPlanLimit({ salonId, metricKey: "services.active" }),
};

const createCategoryFlow = defineAction<CreateCategoryRaw, CreateCategoryFields, string>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: parseCreateCategoryInput,
  run: (input, session) => createServiceCategory(session.salonId, input),
  revalidate: revalidateServices,
});

const updateCategoryPricingFlow = defineAction<
  { categoryId: string; pricingMode: PricingMode },
  { categoryId: string; data: UpdateCategoryInput },
  void
>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: ({ categoryId, pricingMode }) => parseCategoryPricingInput(categoryId, pricingMode),
  run: ({ categoryId, data }, session) => updateServiceCategory(categoryId, session.salonId, data),
  revalidate: revalidateServices,
});

const archiveCategoryFlow = defineAction<string, string, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: parseIdentifier,
  run: (categoryId, session) => archiveServiceCategory(categoryId, session.salonId),
  revalidate: revalidateServices,
});

const createServiceFlow = defineAction<CreateServiceRaw, CreateServiceRaw, string>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: (raw) => ok(raw),
  run: (raw, session) => createServiceWithPlan(session.salonId, raw, servicePlanGate),
  revalidate: revalidateServices,
});

const updateServiceFlow = defineAction<
  { serviceId: string; fields: UpdateServiceRaw },
  { serviceId: string; data: UpdateServiceInput },
  void
>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: ({ serviceId, fields }) => parseUpdateServiceInput(serviceId, fields),
  run: ({ serviceId, data }, session) => updateCatalogService(serviceId, session.salonId, data),
  revalidate: revalidateServices,
});

function readNumber(value: FormDataEntryValue | null): number {
  return typeof value === "string" && value.trim() !== "" ? Number(value) : 0;
}

function readDurationParts(formData: FormData): ServiceDurationParts {
  return {
    hours: readNumber(formData.get("duration_hours")),
    minutes: readNumber(formData.get("duration_minutes_part")),
  };
}

function readActiveFlag(formData: FormData): boolean | undefined {
  if (formData.get("is_active") === "true") return true;
  if (formData.get("is_active") === "false") return false;
  return undefined;
}

export async function createCategoryAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createCategoryFlow({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    ordering: Number(formData.get("ordering") ?? 0),
    pricing_mode: formData.get("pricing_mode") === "variable" ? "variable" : "fixed",
  });
}

export async function updateCategoryPricingModeAction(
  categoryId: string,
  pricingMode: "fixed" | "variable"
): Promise<Result<void>> {
  return updateCategoryPricingFlow({ categoryId, pricingMode });
}

export async function archiveCategoryAction(categoryId: string): Promise<Result<void>> {
  return archiveCategoryFlow(categoryId);
}

export async function createServiceAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createServiceFlow({
    category_id: formData.get("category_id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    duration: readDurationParts(formData),
    price: Number(formData.get("price")),
  });
}

export async function updateServiceAction(
  serviceId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return updateServiceFlow({
    serviceId,
    fields: {
      name: formData.get("name") ?? undefined,
      description: formData.get("description") ?? undefined,
      duration: readDurationParts(formData),
      price: formData.get("price") ? Number(formData.get("price")) : undefined,
      is_active: readActiveFlag(formData),
    },
  });
}
