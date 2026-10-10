import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { setFeedbackReportStatus } from "@/features/platform/use-cases/set-feedback-report-status";
import { ok } from "@/infra/result";
import { formDataOf } from "@/test/action-fixtures";
import { setFeedbackStatusAction } from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/features/platform/use-cases/set-feedback-report-status", () => ({
  setFeedbackReportStatus: vi.fn(),
}));

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";
const REPORT_ID = "00000000-0000-4000-8000-0000000000f1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN_ID);
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
  vi.mocked(setFeedbackReportStatus).mockResolvedValue(ok(undefined));
});

describe("setFeedbackStatusAction", () => {
  it("lanza el mensaje del rate limit sin cambiar el estado", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    await expect(
      setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "resolved" }))
    ).rejects.toThrow("Demasiados intentos. Espera un momento y vuelve a intentarlo.");
    expect(setFeedbackReportStatus).not.toHaveBeenCalled();
  });

  it("marca el reporte como resuelto y revalida la página de reportes", async () => {
    await setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "resolved" }));

    expect(setFeedbackReportStatus).toHaveBeenCalledWith({
      id: REPORT_ID,
      status: "resolved",
      actorUserId: ADMIN_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/reports");
  });

  it("cualquier estado distinto de 'resolved' se normaliza a 'new'", async () => {
    await setFeedbackStatusAction(formDataOf({ id: REPORT_ID, status: "cualquier-cosa" }));

    expect(setFeedbackReportStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "new" })
    );
  });

  it("un id que no es UUID no toca el reporte ni revalida", async () => {
    await setFeedbackStatusAction(formDataOf({ id: "no-uuid", status: "resolved" }));
    await setFeedbackStatusAction(new FormData());

    expect(setFeedbackReportStatus).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
