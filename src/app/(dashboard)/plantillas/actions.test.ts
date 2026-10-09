import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { updateMessageTemplate } from "@/features/notifications/use-cases/update-message-template";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, SALON_ID } from "@/test/action-fixtures";
import { updateNotificationTemplateAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/notifications/use-cases/update-message-template", () => ({
  updateMessageTemplate: vi.fn(),
}));

const remindersSender = buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND] });
const permissionError = "No tienes permiso para editar plantillas.";
const validTemplate = {
  event: "appointment_reminder",
  body_text: "Hola {nombre}, te recordamos tu cita de mañana.",
};

describe("updateNotificationTemplateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(remindersSender);
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
  });

  it("rechaza si el módulo de plantillas no está activo en el plan aunque tenga permiso", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

    expect(await updateNotificationTemplateAction(null, formDataOf(validTemplate))).toEqual({
      ok: false,
      error: permissionError,
    });
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("rechaza si el perfil no tiene permiso de recordatorios", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

    expect(await updateNotificationTemplateAction(null, formDataOf(validTemplate))).toEqual({
      ok: false,
      error: permissionError,
    });
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("rechaza una plantilla demasiado corta con el mensaje de Zod", async () => {
    const result = await updateNotificationTemplateAction(
      null,
      formDataOf({ ...validTemplate, body_text: "corta" })
    );

    expect(result).toEqual({
      ok: false,
      error: "La plantilla debe tener al menos 10 caracteres.",
    });
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("guarda la plantilla con is_active=true cuando el checkbox viene marcado", async () => {
    vi.mocked(updateMessageTemplate).mockResolvedValue(ok(undefined));

    const result = await updateNotificationTemplateAction(
      null,
      formDataOf({ ...validTemplate, is_active: "on" })
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(updateMessageTemplate).toHaveBeenCalledWith(SALON_ID, {
      event: "appointment_reminder",
      body_text: validTemplate.body_text,
      is_active: true,
    });
    for (const path of ["/plantillas", "/recordatorios", "/appointments"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("guarda con is_active=false cuando el checkbox no viene en el formulario", async () => {
    vi.mocked(updateMessageTemplate).mockResolvedValue(ok(undefined));

    await updateNotificationTemplateAction(null, formDataOf(validTemplate));

    expect(updateMessageTemplate).toHaveBeenCalledWith(
      SALON_ID,
      expect.objectContaining({ is_active: false })
    );
  });

  it("no revalida si el guardado falla y devuelve el error", async () => {
    vi.mocked(updateMessageTemplate).mockResolvedValue(err("Plantilla no encontrada."));

    expect(await updateNotificationTemplateAction(null, formDataOf(validTemplate))).toEqual({
      ok: false,
      error: "Plantilla no encontrada.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
