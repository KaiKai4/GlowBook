import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { setFeedbackReportStatus } from "@/features/platform/use-cases/set-feedback-report-status";
import { err, ok } from "@/infra/result";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { formDataOf } from "@/test/action-fixtures";
import { setFeedbackStatusAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/platform/use-cases/set-feedback-report-status", () => ({
  setFeedbackReportStatus: vi.fn(),
}));

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";
const REPORT_ID = "00000000-0000-4000-8000-0000000000e1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN_ID);
  vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  vi.mocked(setFeedbackReportStatus).mockResolvedValue(ok(undefined));
});

describe("setFeedbackStatusAction", () => {
  it("sin ser platform admin propaga la redireccion sin tocar nada", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "resolved" }))).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(setFeedbackReportStatus).not.toHaveBeenCalled();
  });

  it("el rate limit bloqueado lanza su mensaje sin cambiar el reporte ni revalidar", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));

    await expect(setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "resolved" }))).rejects.toThrow(
      "Demasiados intentos."
    );
    expect(setFeedbackReportStatus).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un id que no es UUID se ignora: no llama al caso de uso ni revalida", async () => {
    await expect(setFeedbackStatusAction(formDataOf({ id: "no-uuid", status: "resolved" }))).resolves.toBeUndefined();

    expect(setFeedbackReportStatus).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("marca el reporte como resuelto y revalida el panel de reportes", async () => {
    await setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "resolved" }));

    expect(setFeedbackReportStatus).toHaveBeenCalledWith({
      id: REPORT_ID,
      status: "resolved",
      actorUserId: ADMIN_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/reports");
  });

  it("cualquier estado distinto de 'resolved' vuelve el reporte a 'new'", async () => {
    await setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "otro" }));

    expect(setFeedbackReportStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "new" }));
  });

  it("si el caso de uso falla, lanza su error y no revalida el panel", async () => {
    vi.mocked(setFeedbackReportStatus).mockResolvedValue(err("Reporte inválido."));

    await expect(setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "new" }))).rejects.toThrow(
      "Reporte inválido."
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
