import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSalonActiveStatus } from "@/features/platform/data/salons.repo";
import { recordPlatformAction } from "./platform-audit";
import { updateSalonStatus } from "./update-salon-status";

// Si la escritura se confirma pero la auditoria falla, el caso de uso sigue
// siendo ok y expone el aviso en warnings.

vi.mock("@/features/platform/data/salons.repo", () => ({
  setSalonActiveStatus: vi.fn(),
}));

vi.mock("./platform-audit", () => ({
  recordPlatformAction: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

const mockedSetStatus = vi.mocked(setSalonActiveStatus);
const mockedAudit = vi.mocked(recordPlatformAction);

beforeEach(() => {
  vi.resetAllMocks();
  mockedSetStatus.mockResolvedValue(undefined);
});

describe("updateSalonStatus con auditoria fallida", () => {
  it("devuelve ok con el aviso del efecto de auditoria", async () => {
    mockedAudit.mockResolvedValue(["No se completó el paso «platform.salon_status_changed»."]);

    const result = await updateSalonStatus({ salonId: "salon-1", isActive: false, actorUserId: "admin-1" });

    expect(result).toEqual({
      ok: true,
      value: false,
      warnings: ["No se completó el paso «platform.salon_status_changed»."],
    });
  });

  it("no añade avisos cuando la auditoria se registra bien", async () => {
    mockedAudit.mockResolvedValue([]);

    const result = await updateSalonStatus({ salonId: "salon-1", isActive: true, actorUserId: "admin-1" });

    expect(result).toEqual({ ok: true, value: true });
  });
});
