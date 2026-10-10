// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import { getReminderQueue } from "@/features/reminders";
import { hasPermission } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import RecordatoriosPage from "./page";

vi.mock("@/app/_composition/request-context", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/billing")>()),
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));

vi.mock("@/features/reminders/use-cases/get-reminder-queue", () => ({
  getReminderQueue: vi.fn(),
}));

vi.mock("./reminders-view", () => ({
  RemindersView: () => null,
}));

describe("RecordatoriosPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(isEffectiveSalonModuleEnabled).mockReset();
    vi.mocked(getReminderQueue).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega la vista sin cargar la cola cuando el módulo o el permiso no están disponibles", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await RecordatoriosPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para ver recordatorios.");
    expect(getReminderQueue).not.toHaveBeenCalled();
  });

  it("muestra la cabecera de página con el título y la descripción", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getReminderQueue).mockResolvedValue({
      appointments: [],
      employees: [],
      timezone: "America/Panama",
      salonName: "Salón Luna",
      template: "Hola",
      templateId: undefined,
    } as Awaited<ReturnType<typeof getReminderQueue>>);

    mounted = mountComponent(await RecordatoriosPage());

    expect(getReminderQueue).toHaveBeenCalledWith({ salonId: "salon-1" });
    expect(mounted.container.querySelector("h1")?.textContent).toBe("Recordatorios");
    expect(mounted.container.textContent).toContain("Envia recordatorios de citas de los próximos 7 días.");
  });
});
