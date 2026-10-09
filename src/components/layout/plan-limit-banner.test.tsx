// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { PlanLimitWarning } from "@/features/salon/use-cases/get-dashboard-shell";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { PlanLimitBanner } from "./plan-limit-banner";

function banner(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[role="status"]');
}

describe("PlanLimitBanner", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("no muestra nada cuando no hay avisos de límite", () => {
    mounted = mountComponent(<PlanLimitBanner warnings={[]} />);

    expect(mounted.container.innerHTML).toBe("");
  });

  it("con avisos de cercanía usa el tono de advertencia y el mensaje preventivo", () => {
    const warnings: PlanLimitWarning[] = [{ level: "warning", message: "Citas: 90 de 100 este mes" }];
    mounted = mountComponent(<PlanLimitBanner warnings={warnings} />);

    expect(banner(mounted.container)?.className).toContain("border-warning-border");
    expect(banner(mounted.container)?.textContent).toContain("Te estas acercando a los límites de tu plan");
    expect(banner(mounted.container)?.textContent).toContain("Citas: 90 de 100 este mes");
  });

  it("si algún aviso es de peligro, el banner pasa al tono de peligro", () => {
    const warnings: PlanLimitWarning[] = [
      { level: "warning", message: "Colaboradores: 4 de 5" },
      { level: "danger", message: "Salones: 1 de 1" },
    ];
    mounted = mountComponent(<PlanLimitBanner warnings={warnings} />);

    expect(banner(mounted.container)?.className).toContain("border-danger-border");
    expect(banner(mounted.container)?.textContent).toContain("Tu plan llego a uno de sus límites");
  });

  it("lista cada aviso como un ítem y termina con la invitación a contactar", () => {
    const warnings: PlanLimitWarning[] = [
      { level: "warning", message: "Colaboradores: 4 de 5" },
      { level: "warning", message: "Clientes: 480 de 500" },
    ];
    mounted = mountComponent(<PlanLimitBanner warnings={warnings} />);

    const items = Array.from(mounted.container.querySelectorAll("li")).map((item) => item.textContent);
    expect(items).toEqual(["Colaboradores: 4 de 5", "Clientes: 480 de 500"]);
    expect(mounted.container.textContent).toContain("Contacta a GlowBook para ampliar tu plan");
  });
});
