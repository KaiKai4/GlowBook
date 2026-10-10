import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import { updateMessageTemplate } from "@/features/notifications/use-cases/update-message-template";
import { PERMISSIONS } from "@/features/access";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { updateNotificationTemplateAction } from "./actions";

const { requireActiveProfile } = vi.hoisted(() => ({ requireActiveProfile: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/notifications/use-cases/update-message-template", () => ({
  updateMessageTemplate: vi.fn(),
}));

const editor = buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND] });
const permissionError = "No tienes permiso para editar plantillas.";
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;
const validTemplate = {
  event: "appointment_reminder",
  body_text: "Hola {nombre}, te recordamos tu cita de mañana.",
};
const validForm = () => formDataOf({ ...validTemplate, is_active: "on" });

describe("updateNotificationTemplateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(editor);
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  });

  it("niega la edición cuando el módulo de plantillas no está activo en el plan aunque tenga permiso", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

    expect(await updateNotificationTemplateAction(null, validForm())).toEqual({
      ok: false,
      error: "Este módulo no está incluido en el plan de este salón.",
    });
    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(
      { salonId: editor.salon_id, disabledFeatures: [] },
      "plantillas"
    );
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("niega la edición si el perfil no tiene permiso de envío de recordatorios", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.SALON_MANAGE] }));

    expect(await updateNotificationTemplateAction(null, validForm())).toEqual({
      ok: false,
      error: permissionError,
    });
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite sin guardar la plantilla", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await updateNotificationTemplateAction(null, validForm())).toEqual(RATE_LIMITED);
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("aplica 30 peticiones por minuto en el ámbito plantillas", async () => {
    vi.mocked(updateMessageTemplate).mockResolvedValue(ok(undefined));

    await updateNotificationTemplateAction(null, validForm());

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "plantillas", { max: 30, windowMs: 60_000 });
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

  it("guarda la plantilla con is_active=true cuando el checkbox viene marcado y revalida las vistas afectadas", async () => {
    vi.mocked(updateMessageTemplate).mockResolvedValue(ok(undefined));

    const result = await updateNotificationTemplateAction(null, validForm());

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
    vi.mocked(updateMessageTemplate).mockResolvedValue(err("Evento desconocido."));

    expect(await updateNotificationTemplateAction(null, validForm())).toEqual({
      ok: false,
      error: "Evento desconocido.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
