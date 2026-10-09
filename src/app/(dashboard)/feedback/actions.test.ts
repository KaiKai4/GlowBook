import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { submitFeedback } from "@/features/feedback/use-cases/submit-feedback";
import { err, ok } from "@/infra/result";
import { buildProfile, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { submitFeedbackAction } from "./actions";

vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/feedback/use-cases/submit-feedback", () => ({ submitFeedback: vi.fn() }));

const validInput = { category: "bug" as const, message: "  El botón de guardar no responde  " };

describe("submitFeedbackAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(submitFeedback).mockResolvedValue(ok(undefined));
  });

  it("aplica el límite de 5 envíos cada 5 minutos por usuario y no envía si se excede", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));

    const result = await submitFeedbackAction(validInput);

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "feedback", {
      max: 5,
      windowMs: 300_000,
    });
    expect(result).toEqual({ ok: false, error: "Demasiados intentos." });
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it("rechaza un mensaje demasiado corto con el mensaje de validación", async () => {
    const result = await submitFeedbackAction({ category: "suggestion", message: "hola" });

    expect(result).toEqual({
      ok: false,
      error: "Cuéntanos un poco más (mínimo 5 caracteres).",
    });
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it("rechaza un mensaje que supera los 2000 caracteres", async () => {
    const result = await submitFeedbackAction({ category: "other", message: "a".repeat(2001) });

    expect(result).toEqual({ ok: false, error: "El mensaje es demasiado largo." });
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it("envía el reporte con el salón y autor del perfil y el mensaje sin espacios sobrantes", async () => {
    const result = await submitFeedbackAction(validInput);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(submitFeedback).toHaveBeenCalledWith(
      { salonId: SALON_ID, createdBy: USER_ID },
      { category: "bug", message: "El botón de guardar no responde" }
    );
  });

  it("devuelve el error del caso de uso si el envío falla", async () => {
    vi.mocked(submitFeedback).mockResolvedValue(err("No se pudo enviar el reporte. Intenta de nuevo."));

    expect(await submitFeedbackAction(validInput)).toEqual({
      ok: false,
      error: "No se pudo enviar el reporte. Intenta de nuevo.",
    });
  });
});
