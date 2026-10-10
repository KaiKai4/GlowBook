// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { OnboardingChecklist } from "@/features/dashboard";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { OnboardingChecklistCard } from "./onboarding-checklist-card";

function checklist(doneKeys: string[]): OnboardingChecklist {
  const steps = (["services", "employees", "customers", "appointments"] as const).map((key) => ({
    key,
    done: doneKeys.includes(key),
  }));
  return { steps, doneCount: doneKeys.length, complete: doneKeys.length === steps.length };
}

describe("OnboardingChecklistCard", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("no se muestra cuando el salón ya completó la configuración", () => {
    mounted = mountComponent(
      <OnboardingChecklistCard checklist={checklist(["services", "employees", "customers", "appointments"])} />
    );

    expect(mounted.container.innerHTML).toBe("");
  });

  it("muestra el progreso y un enlace por cada paso pendiente o completado", () => {
    mounted = mountComponent(<OnboardingChecklistCard checklist={checklist(["services"])} />);

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Configura tu salón");
    expect(mounted.container.textContent).toContain("1 de 4");
    const links = Array.from(mounted.container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/services",
      "/employees",
      "/customers",
      "/appointments/new",
    ]);
  });

  it("la barra de progreso refleja la fracción de pasos completados", () => {
    mounted = mountComponent(<OnboardingChecklistCard checklist={checklist(["services", "employees"])} />);

    const bar = mounted.container.querySelector<HTMLElement>("div[style]");
    expect(bar?.style.width).toBe("50%");
  });

  it("los pasos pendientes muestran su descripción y los completados aparecen tachados sin ella", () => {
    mounted = mountComponent(<OnboardingChecklistCard checklist={checklist(["services"])} />);

    const [done, pending] = Array.from(mounted.container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(done?.textContent).toBe("Crea tus servicios");
    expect(done?.textContent).not.toContain("Define qué ofreces, su duración y precio.");
    expect(done?.querySelector("p")?.className).toContain("line-through");
    expect(pending?.textContent).toContain("Agrega tus colaboradores");
    expect(pending?.textContent).toContain("Tu equipo, sus horarios y los servicios que realizan.");
    expect(pending?.querySelector("p")?.className).not.toContain("line-through");
  });

  it("los pasos completados muestran una marca de verificación en lugar de su número", () => {
    mounted = mountComponent(<OnboardingChecklistCard checklist={checklist(["services"])} />);

    const badges = Array.from(mounted.container.querySelectorAll<HTMLElement>("a > span"));
    expect(badges[0]?.querySelector("svg")).not.toBeNull();
    expect(badges[0]?.textContent).toBe("");
    expect(badges[1]?.textContent).toBe("2");
  });
});
