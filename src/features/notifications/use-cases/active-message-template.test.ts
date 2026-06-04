import { describe, expect, it, vi } from "vitest";
import { findActiveMessageTemplate } from "../data/notification-templates.repo";
import { getActiveMessageTemplate } from "./active-message-template";

vi.mock("../data/notification-templates.repo", () => ({
  findActiveMessageTemplate: vi.fn(),
}));

const mockedFindActiveMessageTemplate = vi.mocked(findActiveMessageTemplate);

describe("active message template", () => {
  it("maps the active template to a narrow message template view", async () => {
    mockedFindActiveMessageTemplate.mockResolvedValue({
      id: "template-1",
      body_text: "Hola {cliente}",
    } as Awaited<ReturnType<typeof findActiveMessageTemplate>>);

    await expect(getActiveMessageTemplate("salon-1", "appointment_reminder")).resolves.toEqual({
      id: "template-1",
      bodyText: "Hola {cliente}",
    });
  });
});
