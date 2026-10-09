import { beforeEach, describe, expect, it, vi } from "vitest";
import { findMessageTemplates } from "../data/notification-templates.repo";
import { DEFAULT_MESSAGE_TEMPLATES } from "../domain/templates";
import { getTemplateSettings } from "./get-template-settings";

// Pantalla de ajustes de plantillas: siempre devuelve las dos plantillas del
// salon consultado, nunca de otro, y propaga los fallos de lectura.

vi.mock("server-only", () => ({}));

vi.mock("../data/notification-templates.repo", () => ({
  findMessageTemplates: vi.fn(),
}));

const mockedFindTemplates = vi.mocked(findMessageTemplates);

const SALON_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getTemplateSettings", () => {
  it("loads the templates of the requested salon only", async () => {
    mockedFindTemplates.mockResolvedValue([
      DEFAULT_MESSAGE_TEMPLATES.appointment_reminder,
      DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled,
    ]);

    await getTemplateSettings(SALON_ID);

    expect(mockedFindTemplates).toHaveBeenCalledTimes(1);
    expect(mockedFindTemplates).toHaveBeenCalledWith(SALON_ID);
  });

  it("wraps the templates in the settings view model", async () => {
    const templates = [
      DEFAULT_MESSAGE_TEMPLATES.appointment_reminder,
      { ...DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled, id: "tpl-9", is_active: false },
    ];
    mockedFindTemplates.mockResolvedValue(templates);

    await expect(getTemplateSettings(SALON_ID)).resolves.toEqual({ templates });
  });

  it("propagates read failures instead of showing an empty configuration", async () => {
    const readError = new Error("denied");
    mockedFindTemplates.mockRejectedValue(readError);

    await expect(getTemplateSettings(SALON_ID)).rejects.toBe(readError);
  });
});
