import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminHome } from "./get-admin-home";
import { getPlatformAdminHome } from "./get-platform-admin-home";
import { getPlatformSalonOverviews } from "./get-platform-salon-overviews";

vi.mock("./get-platform-admin-home", () => ({ getPlatformAdminHome: vi.fn() }));
vi.mock("./get-platform-salon-overviews", () => ({ getPlatformSalonOverviews: vi.fn() }));

const HOME = { salons: [], pendingInvitations: [], metrics: { totalSalons: 0, activeSalons: 0, pendingInvitations: 0 } };
const SALON_VIEW = { salons: [], metrics: { totalSalons: 0, activeSalons: 0, totalAppointments: 0, dormantSalons: 0 }, dormantSalons: [] };

describe("getAdminHome", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPlatformAdminHome).mockResolvedValue(HOME);
    vi.mocked(getPlatformSalonOverviews).mockResolvedValue(SALON_VIEW);
  });

  it("compone el inicio y los salones en una sola llamada, cada fuente una sola vez", async () => {
    const result = await getAdminHome();

    expect(result).toEqual({ home: HOME, salonView: SALON_VIEW });
    expect(getPlatformAdminHome).toHaveBeenCalledTimes(1);
    expect(getPlatformSalonOverviews).toHaveBeenCalledTimes(1);
  });

  it("propaga el fallo de cualquiera de las fuentes", async () => {
    vi.mocked(getPlatformSalonOverviews).mockRejectedValue(new Error("db caída"));

    await expect(getAdminHome()).rejects.toThrow("db caída");
  });
});
