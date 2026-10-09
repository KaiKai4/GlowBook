import { toPublicErrorMessage } from "@/lib/errors";
import "server-only";

import { z } from "@/lib/validation/zod";

import { err, ok, type Result } from "@/lib/result";
import type { CommercialAddon } from "../domain/salon-extras";
import {
  archiveCommercialAddon,
  countAddonAssignments,
  deleteCommercialAddon,
  saveCommercialAddon,
} from "../data/commercial-addons.repo";
import { auditBilling, normalizeKey } from "./billing-shared";
import { firstIssueMessage } from "@/lib/validation/first-issue";

const AddonSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2, "Escribe el nombre del extra.").max(100),
    code: z.string().trim().max(80).optional(),
    description: z.string().trim().max(400).default(""),
    kind: z.enum(["module", "limit_boost"]),
    moduleKey: z.string().trim().optional(),
    metricKey: z.string().trim().optional(),
    limitDelta: z
      .union([z.coerce.number().int().min(1), z.literal("")])
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
    currency: z.string().trim().length(3).default("USD"),
    monthlyPrice: z.coerce.number().min(0, "El precio no puede ser negativo."),
    status: z.enum(["draft", "active", "archived"]).default("active"),
    sortOrder: z.coerce.number().int().default(0),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "module" && !value.moduleKey) {
      ctx.addIssue({ code: "custom", message: "Selecciona el modulo que activa este extra." });
    }
    if (value.kind === "limit_boost" && !value.metricKey) {
      ctx.addIssue({ code: "custom", message: "Selecciona el límite que aumenta este extra." });
    }
    if (value.kind === "limit_boost" && value.limitDelta === null) {
      ctx.addIssue({ code: "custom", message: "Indica cuanto aumenta el límite." });
    }
  });

export type { CommercialAddon };

export async function saveCommercialAddonConfig(
  input: z.input<typeof AddonSchema>,
  actorUserId?: string | null
): Promise<Result<string>> {
  const parsed = AddonSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  try {
    const id = await saveCommercialAddon({
      id: parsed.data.id,
      code: normalizeKey(parsed.data.code || parsed.data.name),
      name: parsed.data.name,
      description: parsed.data.description,
      kind: parsed.data.kind,
      moduleKey: parsed.data.kind === "module" ? parsed.data.moduleKey ?? null : null,
      metricKey: parsed.data.kind === "limit_boost" ? parsed.data.metricKey ?? null : null,
      limitDelta: parsed.data.kind === "limit_boost" ? parsed.data.limitDelta : null,
      currency: parsed.data.currency.toUpperCase(),
      monthlyPrice: parsed.data.monthlyPrice,
      status: parsed.data.status,
      sortOrder: parsed.data.sortOrder,
    });
    await auditBilling(actorUserId, "commercial_addon_saved", id);
    return ok(id);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo guardar el extra."));
  }
}

export async function removeCommercialAddonConfig(
  addonId: string,
  actorUserId?: string | null
): Promise<Result<void>> {
  try {
    const assignments = await countAddonAssignments(addonId);
    if (assignments > 0) {
      await archiveCommercialAddon(addonId);
      await auditBilling(actorUserId, "commercial_addon_archived", addonId);
    } else {
      await deleteCommercialAddon(addonId);
      await auditBilling(actorUserId, "commercial_addon_deleted", addonId);
    }
    return ok(undefined);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo eliminar el extra."));
  }
}
