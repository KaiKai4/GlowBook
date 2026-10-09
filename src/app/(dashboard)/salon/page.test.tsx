// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonSettings, type SalonSettingsViewModel } from "@/features/salon/use-cases/get-salon-settings";
import { hasPermission } from "@/lib/auth/permissions";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import SalonSettingsPage from "./page";
import { SalonSettings } from "./salon-settings";

vi.mock("@/lib/auth/session", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/lib/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/permissions")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/salon/use-cases/get-salon-settings", () => ({
  getSalonSettings: vi.fn(),
}));

vi.mock("./actions", () => ({
  updateSalonInfoAction: vi.fn(),
  updateBusinessHoursAction: vi.fn(),
  updateSalonThemeAction: vi.fn(),
  updateSalonBgAction: vi.fn(),
  updateSalonPaymentMethodsAction: vi.fn(),
}));

const SETTINGS: SalonSettingsViewModel = {
  salonName: "Salón Lumière",
  timezone: "America/Panama",
  theme: "rosewater",
  bgStyle: "colored",
  paymentMethods: ["Efectivo"],
  paymentMethodOptions: [],
  businessHours: [{ day_of_week: 0, is_open: true, open_time: "09:00", close_time: "18:00" }],
};

describe("SalonSettingsPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(getSalonSettings).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega la configuración sin cargar ajustes cuando no tiene permiso de gestión", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await SalonSettingsPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para configurar el salon.");
    expect(getSalonSettings).not.toHaveBeenCalled();
  });

  it("carga los ajustes del salón y los entrega al formulario de configuración", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getSalonSettings).mockResolvedValue(SETTINGS);

    const element = await SalonSettingsPage();

    expect(getSalonSettings).toHaveBeenCalledWith("salon-1");
    expect(element.type).toBe(SalonSettings);
    expect(element.props).toEqual({
      salonName: "Salón Lumière",
      timezone: "America/Panama",
      theme: "rosewater",
      bgStyle: "colored",
      paymentMethods: ["Efectivo"],
      businessHours: SETTINGS.businessHours,
    });
  });
});
