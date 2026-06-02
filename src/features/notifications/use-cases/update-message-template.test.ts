import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertMessageTemplate } from "../data/notification-templates.repo";
import { updateMessageTemplate } from "./update-message-template";

vi.mock("../data/notification-templates.repo", () => ({
  upsertMessageTemplate: vi.fn(),
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
      name: "Cancelacion WhatsApp",
      body_text: "Hola {{customer_name}}, tu cita fue cancelada.",
      is_active: false,
    });
  });

  it("returns a stable business error when persistence fails", async () => {
    mockedUpsertMessageTemplate.mockRejectedValue(new Error("database down"));

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
  });
});
