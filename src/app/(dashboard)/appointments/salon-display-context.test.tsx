// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { SALON_DISPLAY, mountWithSalon } from "@/test/ui-salon-display";
import { useSalonDisplay } from "./salon-display-context";

function Probe() {
  const { tz, salonName } = useSalonDisplay();
  return <p>{`${tz} | ${salonName}`}</p>;
}

describe("useSalonDisplay", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  it("entrega la zona horaria y el nombre del salón del proveedor", () => {
    mounted = mountWithSalon(<Probe />, SALON_DISPLAY);

    expect(mounted.container.textContent).toBe(`${SALON_DISPLAY.tz} | ${SALON_DISPLAY.salonName}`);
  });

  it("falla con un mensaje claro si se usa fuera de SalonDisplayProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => {
      mounted = mountComponent(<Probe />);
    }).toThrow("useSalonDisplay debe usarse dentro de SalonDisplayProvider");
  });
});
