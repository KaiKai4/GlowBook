import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedbackReport } from "../data/feedback.repo";
import { submitFeedback } from "./submit-feedback";

vi.mock("../data/feedback.repo", () => ({
  createFeedbackReport: vi.fn(),
}));

const mockedCreateFeedbackReport = vi.mocked(createFeedbackReport);

describe("submit feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a tenant feedback report through the Supabase adapter", async () => {
    mockedCreateFeedbackReport.mockResolvedValue(undefined);

    const result = await submitFeedback(
      { salonId: "salon-1", createdBy: "profile-1" },
      { category: "bug", message: "El calendario no carga." }
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedCreateFeedbackReport).toHaveBeenCalledWith({
      salonId: "salon-1",
      createdBy: "profile-1",
      category: "bug",
      message: "El calendario no carga.",
    });
  });

  it("returns a business error when the adapter fails", async () => {
    mockedCreateFeedbackReport.mockRejectedValue(new Error("insert failed"));

    const result = await submitFeedback(
      { salonId: "salon-1", createdBy: "profile-1" },
      { category: "suggestion", message: "Agreguen filtros por cliente." }
    );

    expect(result).toEqual({
      ok: false,
      error: "No se pudo enviar el reporte. Intenta de nuevo.",
    });
  });
});
