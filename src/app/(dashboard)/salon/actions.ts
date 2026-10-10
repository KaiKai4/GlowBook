"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import { parseBusinessHoursJson } from "@/features/salon";
import { updateBusinessHours } from "@/features/salon";
import { updateSalonBackground } from "@/features/salon";
import { updateSalonInfo } from "@/features/salon";
import { updateSalonPaymentMethods } from "@/features/salon";
import { updateSalonTheme } from "@/features/salon";
import {
  SalonInfoSchema,
  SalonPaymentMethodsSchema,
  type BusinessDayInput,
  type SalonInfoInput,
  type SalonPaymentMethodsInput,
} from "@/features/salon/schemas";
import { ok, type Result } from "@/infra/result";

// Las acciones solo adaptan la entrada y pasan por el pipeline de defineAction.
// Tema, fondo y nombre cambian el layout completo del dashboard: se revalida el layout.

const PERMISSION = {
  key: PERMISSIONS.SALON_MANAGE,
  deniedMessage: "No tienes permiso para editar el salón.",
};
const RATE_LIMIT = { scope: "salon", options: RATE_LIMIT_POLICIES.write };
const LAYOUT = { path: "/", type: "layout" } as const;

const updateInfoFlow = defineAction<FormData, SalonInfoInput, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: (formData) => parseWithSchema(SalonInfoSchema)({ name: formData.get("name") }),
  run: (input, session) => updateSalonInfo(session.salonId, input),
  revalidate: () => [LAYOUT],
});

const updateThemeFlow = defineAction<string, string, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: (theme) => ok(theme),
  run: (theme, session) => updateSalonTheme(session.salonId, theme),
  revalidate: () => [LAYOUT],
});

const updateBackgroundFlow = defineAction<string, string, void>({
  permission: PERMISSION,
  rateLimit: RATE_LIMIT,
  parse: (bgStyle) => ok(bgStyle),
  run: (bgStyle, session) => updateSalonBackground(session.salonId, bgStyle),
  revalidate: () => [LAYOUT],
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

export async function updateSalonInfoAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return updateInfoFlow(formData);
}

export async function updateSalonThemeAction(theme: string): Promise<Result<void>> {
  return updateThemeFlow(theme);
}

export async function updateSalonBgAction(bgStyle: string): Promise<Result<void>> {
  return updateBackgroundFlow(bgStyle);
}

export async function updateBusinessHoursAction(hoursJson: string): Promise<Result<void>> {
  return updateBusinessHoursFlow(hoursJson);
}

export async function updateSalonPaymentMethodsAction(
  paymentMethods: string[]
): Promise<Result<void>> {
  return updatePaymentMethodsFlow(paymentMethods);
}
