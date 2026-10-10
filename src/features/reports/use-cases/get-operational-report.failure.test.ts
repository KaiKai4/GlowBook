import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { findSalonReportIdentity } from "../data/reports.repo";
import { getOperationalReport } from "./get-operational-report";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

vi.mock("../data/reports.repo", () => ({
  findSalonReportIdentity: vi.fn(),
}));

const FALLBACK = "No se pudo cargar el reporte operativo.";
const SALON_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-06-03T12:00:00.000Z");

describe("getOperationalReport: fallo tecnico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve el mensaje fijo y registra el error con el contexto del caso de uso", async () => {
    const technical = new Error('relation "public.reports" does not exist');
    vi.mocked(findSalonReportIdentity).mockRejectedValue(technical);

    const result = await getOperationalReport({
      salonId: SALON_ID,
      filters: { preset: "mes", from: undefined, to: undefined },
      now: NOW,
    });

    expect(result).toEqual({ ok: false, error: FALLBACK });
    expect(captureError).toHaveBeenCalledWith(technical, {
      module: "reports",
      action: "operational-report",
    });
  });
});
