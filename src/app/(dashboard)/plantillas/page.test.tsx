// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import { getTemplateSettings } from "@/features/notifications/use-cases/get-template-settings";
import { hasPermission } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import PlantillasPage from "./page";

vi.mock("@/app/_composition/request-context", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));

vi.mock("@/features/notifications/use-cases/get-template-settings", () => ({
  getTemplateSettings: vi.fn(),
}));

vi.mock("./templates-manager", () => ({
  TemplatesManager: () => null,
}));

describe("PlantillasPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(isEffectiveSalonModuleEnabled).mockReset();
    vi.mocked(getTemplateSettings).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega la edición sin cargar plantillas cuando el módulo no está habilitado", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
    vi.mocked(hasPermission).mockReturnValue(true);

    mounted = mountComponent(await PlantillasPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para editar plantillas.");
    expect(getTemplateSettings).not.toHaveBeenCalled();
  });

  it("muestra la cabecera de página con el título y la descripción", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getTemplateSettings).mockResolvedValue({ templates: [] });

    mounted = mountComponent(await PlantillasPage());

    expect(getTemplateSettings).toHaveBeenCalledWith("salon-1");
    expect(mounted.container.querySelector("h1")?.textContent).toBe("Plantillas");
    expect(mounted.container.textContent).toContain(
      "Personaliza los mensajes de WhatsApp usados en recordatorios y cancelaciones."
    );
  });
});
