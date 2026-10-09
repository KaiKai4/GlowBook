"use server";

import { revalidatePath } from "next/cache";
import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import { parseBusinessHoursJson } from "@/features/salon/use-cases/business-hours-input";
import { updateBusinessHours } from "@/features/salon/use-cases/update-business-hours";
import { updateSalonBackground } from "@/features/salon/use-cases/update-salon-background";
import { updateSalonInfo } from "@/features/salon/use-cases/update-salon-info";
import { updateSalonPaymentMethods } from "@/features/salon/use-cases/update-salon-payment-methods";
import { updateSalonTheme } from "@/features/salon/use-cases/update-salon-theme";
import {
  SalonInfoSchema,
  SalonPaymentMethodsSchema,
  type BusinessDayInput,
  type SalonInfoInput,
  type SalonPaymentMethodsInput,
} from "@/features/salon/schemas";
import { ok, type Result } from "@/infra/result";

// Las acciones solo adaptan la entrada y pasan por el pipeline de defineAction.
// La revalidacion del layout completo (tema, fondo, nombre) queda fuera de
// revalidate porque defineAction solo revalida rutas por ruta.

const PERMISSION = {
  key: PERMISSIONS.SALON_MANAGE,
  deniedMessage: "No tienes permiso para editar el salon.",
};
const RATE_LIMIT = { scope: "salon", options: { max: 60, windowMs: 60_000 } };

const updateInfoFlow = defineAction<FormData, SalonInfoInput, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: (formData) => parseWithSchema(SalonInfoSchema)({ name: formData.get("name") }),
  run: (input, session) => updateSalonInfo(session.salonId, input),
});

const updateThemeFlow = defineAction<string, string, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: (theme) => ok(theme),
  run: (theme, session) => updateSalonTheme(session.salonId, theme),
});

const updateBackgroundFlow = defineAction<string, string, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: (bgStyle) => ok(bgStyle),
  run: (bgStyle, session) => updateSalonBackground(session.salonId, bgStyle),
});

const updateBusinessHoursFlow = defineAction<string, BusinessDayInput[], void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: parseBusinessHoursJson,
  run: (hours, session) => updateBusinessHours(session.salonId, hours),
  revalidate: () => ["/salon", "/appointments", "/appointments/new"],
});

const updatePaymentMethodsFlow = defineAction<string[], SalonPaymentMethodsInput, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: parseWithSchema(SalonPaymentMethodsSchema),
  run: (paymentMethods, session) => updateSalonPaymentMethods(session.salonId, paymentMethods),
  revalidate: () => ["/salon", "/appointments", "/retail"],
});

function revalidateLayout<T>(result: Result<T>): Result<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateSalonInfoAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return revalidateLayout(await updateInfoFlow(formData));
}

export async function updateSalonThemeAction(theme: string): Promise<Result<void>> {
  return revalidateLayout(await updateThemeFlow(theme));
}

export async function updateSalonBgAction(bgStyle: string): Promise<Result<void>> {
  return revalidateLayout(await updateBackgroundFlow(bgStyle));
}

export async function updateBusinessHoursAction(hoursJson: string): Promise<Result<void>> {
  return updateBusinessHoursFlow(hoursJson);
}

export async function updateSalonPaymentMethodsAction(
  paymentMethods: string[]
): Promise<Result<void>> {
  return updatePaymentMethodsFlow(paymentMethods);
}
