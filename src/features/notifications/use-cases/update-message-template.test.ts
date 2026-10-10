import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { upsertMessageTemplate } from "../data/notification-templates.repo";
import { updateMessageTemplate } from "./update-message-template";

vi.mock("../data/notification-templates.repo", () => ({
  upsertMessageTemplate: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedUpsertMessageTemplate = vi.mocked(upsertMessageTemplate);

describe("update message template", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUpsertMessageTemplate.mockResolvedValue(undefined);
  });

  it("maps editable template input to the persisted default template identity", async () => {
    const result = await updateMessageTemplate("salon-1", {
      event: "appointment_cancelled",
      body_text: "Hola {{customer_name}}, tu cita fue cancelada.",
      is_active: false,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedUpsertMessageTemplate).toHaveBeenCalledWith("salon-1", {
      event: "appointment_cancelled",
      name: "Cancelación WhatsApp",
      body_text: "Hola {{customer_name}}, tu cita fue cancelada.",
      is_active: false,
    });
  });

  it("registra el fallo de persistencia con captureError y devuelve el error de negocio", async () => {
    const dbError = new Error("database down");
    mockedUpsertMessageTemplate.mockRejectedValue(dbError);

    await expect(
      updateMessageTemplate("salon-1", {
        event: "appointment_reminder",
        body_text: "Hola {{customer_name}}, recuerda tu cita.",
        is_active: true,
      })
    ).resolves.toEqual({
      ok: false,
      error: "No se pudo guardar la plantilla.",
    });
    expect(captureError).toHaveBeenCalledWith(dbError, {
      module: "notifications",
      action: "update_template",
    });
  });
});
