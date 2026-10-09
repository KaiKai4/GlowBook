import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { updateMessageTemplate } from "@/features/notifications/use-cases/update-message-template";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { err, ok } from "@/lib/result";
import { buildProfile, formDataOf, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { updateNotificationTemplateAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/notifications/use-cases/update-message-template", () => ({
  updateMessageTemplate: vi.fn(),
}));

const editor = buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND] });
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;
const validForm = () =>
  formDataOf({ event: "appointment_reminder", body_text: "Hola {nombre}", is_active: "on" });

describe("updateNotificationTemplateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(editor);
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  });

  it("niega la edición cuando el módulo de plantillas está deshabilitado", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

    expect(await updateNotificationTemplateAction(null, validForm())).toEqual({
      ok: false,
      error: "No tienes permiso para editar plantillas.",
    });
    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(editor, "plantillas");
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("niega la edición sin permiso de envío de recordatorios", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.SALON_MANAGE] }));

    expect((await updateNotificationTemplateAction(null, validForm())).ok).toBe(false);
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

  it("rechaza un cuerpo de plantilla vacío con el primer mensaje de validación", async () => {
    const result = await updateNotificationTemplateAction(
      null,
      formDataOf({ event: "appointment_reminder", body_text: "" })
    );

    expect(result.ok).toBe(false);
    expect(updateMessageTemplate).not.toHaveBeenCalled();
  });

  it("guarda la plantilla con is_active según el checkbox y revalida las vistas afectadas", async () => {
    vi.mocked(updateMessageTemplate).mockResolvedValue(ok(undefined));

    expect(await updateNotificationTemplateAction(null, formDataOf({ event: "appointment_reminder", body_text: "Hola, tu cita es pronto" }))).toEqual(
      ok(undefined)
    );
    expect(updateMessageTemplate).toHaveBeenLastCalledWith(
      SALON_ID,
      expect.objectContaining({ event: "appointment_reminder", body_text: "Hola, tu cita es pronto", is_active: false })
    );

    await updateNotificationTemplateAction(null, validForm());
    expect(updateMessageTemplate).toHaveBeenLastCalledWith(
      SALON_ID,
      expect.objectContaining({ is_active: true })
    );

    expect(revalidatePath).toHaveBeenCalledWith("/plantillas");
    expect(revalidatePath).toHaveBeenCalledWith("/recordatorios");
    expect(revalidatePath).toHaveBeenCalledWith("/appointments");
  });

  it("no revalida cuando la plantilla no se puede guardar", async () => {
    vi.mocked(updateMessageTemplate).mockResolvedValue(err("Evento desconocido."));

    expect(await updateNotificationTemplateAction(null, validForm())).toEqual({
      ok: false,
      error: "Evento desconocido.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
