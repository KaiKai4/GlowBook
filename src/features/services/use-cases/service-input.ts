import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { parseUuid } from "@/infra/validation/route-id";
import type { z } from "@/infra/validation/zod";
import {
  combineServiceDuration,
  isValidServiceDurationParts,
  type ServiceDurationParts,
} from "../domain/duration";
import {
  CreateCategorySchema,
  CreateServiceSchema,
  UpdateCategorySchema,
  UpdateServiceSchema,
  type CreateServiceInput,
  type UpdateCategoryInput,
  type UpdateServiceInput,
} from "../schemas";

// Validacion de entrada de los casos de uso de servicios. Las acciones solo
// adaptan el formulario y delegan aquí; el orden de validacion se conserva.

const INVALID_ID_MESSAGE = "Identificador inválido.";
const DURATION_MESSAGE = "Indica una duración válida: horas desde 0 y minutos entre 0 y 59.";

export type PricingMode = "fixed" | "variable";

export interface CreateCategoryRaw {
  name: unknown;
  description: unknown;
  ordering: number;
  pricing_mode: PricingMode;
}

export interface CreateServiceRaw {
  category_id: unknown;
  name: unknown;
  description: unknown;
  duration: ServiceDurationParts;
  price: number;
}

export interface UpdateServiceRaw {
  name: unknown;
  description: unknown;
  duration: ServiceDurationParts;
  price: number | undefined;
  is_active: boolean | undefined;
}

export type CreateCategoryFields = z.infer<typeof CreateCategorySchema>;

function validate<T>(schema: z.ZodType<T>, raw: unknown): Result<T> {
  const parsed = schema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(firstIssueMessage(parsed.error));
}

export function parseIdentifier(id: string): Result<string> {
  return parseUuid(id) ? ok(id) : err(INVALID_ID_MESSAGE);
}

function parseServiceDuration(parts: ServiceDurationParts): Result<number> {
  if (!isValidServiceDurationParts(parts)) return err(DURATION_MESSAGE);
  return ok(combineServiceDuration(parts));
}

export function parseCreateCategoryInput(raw: CreateCategoryRaw): Result<CreateCategoryFields> {
  return validate(CreateCategorySchema, raw);
}

export function parseCategoryPricingInput(
  categoryId: string,
  pricingMode: PricingMode
): Result<{ categoryId: string; data: UpdateCategoryInput }> {
  const id = parseIdentifier(categoryId);
  if (!id.ok) return id;
  const data = validate(UpdateCategorySchema, { pricing_mode: pricingMode });
  if (!data.ok) return data;
  return ok({ categoryId: id.value, data: data.value });
}

export function parseCreateServiceInput(raw: CreateServiceRaw): Result<CreateServiceInput> {
  const duration = parseServiceDuration(raw.duration);
  if (!duration.ok) return duration;
  return validate(CreateServiceSchema, {
    category_id: raw.category_id,
    name: raw.name,
    description: raw.description,
    duration_minutes: duration.value,
    price: raw.price,
  });
}

export function parseUpdateServiceInput(
  serviceId: string,
  raw: UpdateServiceRaw
): Result<{ serviceId: string; data: UpdateServiceInput }> {
  const id = parseIdentifier(serviceId);
  if (!id.ok) return id;
  const duration = parseServiceDuration(raw.duration);
  if (!duration.ok) return duration;
  const data = validate(UpdateServiceSchema, {
    name: raw.name,
    description: raw.description,
    duration_minutes: duration.value,
    price: raw.price,
    is_active: raw.is_active,
  });
  if (!data.ok) return data;
  return ok({ serviceId: id.value, data: data.value });
}
