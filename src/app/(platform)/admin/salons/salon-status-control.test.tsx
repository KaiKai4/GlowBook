// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/lib/result";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, flushAsync, getButtonByText } from "@/test/ui-admin-dom";
import { updateSalonStatusAction } from "../actions";
import { SalonStatusControl } from "./salon-status-control";

vi.mock("../actions", () => ({ updateSalonStatusAction: vi.fn() }));

describe("SalonStatusControl", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(updateSalonStatusAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  it("pide confirmación con el nombre del salón y no actúa si se cancela", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mounted = mountComponent(<SalonStatusControl salonId="salon-1" salonName="Salón Luna" isActive />);

    clickElement(getButtonByText(mounted.container, "Suspender"));

    expect(confirm).toHaveBeenCalledWith('Vas a suspender "Salón Luna".');
    expect(updateSalonStatusAction).not.toHaveBeenCalled();
  });

  it("reactiva un salón suspendido enviando isActive=true y muestra la confirmación", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(updateSalonStatusAction).mockResolvedValue(ok(undefined));
    mounted = mountComponent(<SalonStatusControl salonId="salon-1" salonName="Salón Luna" isActive={false} />);

    clickElement(getButtonByText(mounted.container, "Reactivar"));
    await flushAsync();

    expect(updateSalonStatusAction).toHaveBeenCalledWith("salon-1", true);
    expect(mounted.container.textContent).toContain("Actualizado");
  });

  it("suspende un salón activo enviando isActive=false y muestra el error de la acción", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(updateSalonStatusAction).mockResolvedValue(err("No tienes permisos para suspender."));
    mounted = mountComponent(<SalonStatusControl salonId="salon-1" salonName="Salón Luna" isActive />);

    clickElement(getButtonByText(mounted.container, "Suspender"));
    await flushAsync();

    expect(updateSalonStatusAction).toHaveBeenCalledWith("salon-1", false);
    expect(mounted.container.textContent).toContain("No tienes permisos para suspender.");
  });
});
