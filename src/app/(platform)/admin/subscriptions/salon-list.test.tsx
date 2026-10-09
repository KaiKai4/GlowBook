// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { SalonSubscriptionRow } from "@/features/billing/use-cases/salon-subscriptions";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { SalonSubscriptionList } from "./salon-list";

function row(overrides: Partial<SalonSubscriptionRow>): SalonSubscriptionRow {
  return {
    salonId: "salon-1",
    salonName: "Salón Luna",
    salonIsActive: true,
    planId: "plan-1",
    planName: "Pro",
    planPrice: 30,
    currency: "USD",
    status: "active",
    trialEndsAt: null,
    extrasCount: 0,
    extrasPrice: 0,
    monthlyTotal: 30,
    openAlertCount: 0,
    ...overrides,
  };
}

const rows: SalonSubscriptionRow[] = [
  row({}),
  row({ salonId: "salon-2", salonName: "Barbería Norte", planName: null, planId: null, status: null }),
];

describe("SalonSubscriptionList", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("enlaza cada salón con su ficha de suscripción", () => {
    mounted = mountComponent(<SalonSubscriptionList rows={rows} selectedSalonId={null} />);

    const links = Array.from(mounted.container.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/subscriptions?salon=salon-1",
      "/admin/subscriptions?salon=salon-2",
    ]);
  });

  it("resalta solo el salón seleccionado", () => {
    mounted = mountComponent(<SalonSubscriptionList rows={rows} selectedSalonId="salon-2" />);

    const links = Array.from(mounted.container.querySelectorAll("a"));
    expect(links[0]?.className).toContain("border-transparent");
    expect(links[1]?.className).toContain("border-brand-300");
  });

  it("filtra por nombre de salón o de plan y muestra mensaje si no hay coincidencias", () => {
    mounted = mountComponent(<SalonSubscriptionList rows={rows} selectedSalonId={null} />);
    const input = mounted.container.querySelector<HTMLInputElement>('input[type="search"]');
    expect(input).not.toBeNull();

    act(() => {
      setInputValue(input, "barbería");
    });
    expect(linkTexts(mounted.container)).toEqual([expect.stringContaining("Barbería Norte")]);

    act(() => {
      setInputValue(input, "pro");
    });
    expect(linkTexts(mounted.container)).toEqual([expect.stringContaining("Salón Luna")]);

    act(() => {
      setInputValue(input, "inexistente");
    });
    expect(mounted.container.textContent).toContain("No hay salones que coincidan con la busqueda.");
  });
});

function linkTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("a"), (link) => link.textContent ?? "");
}

/** Cambia el valor de un input controlado por React y dispara su evento input. */
function setInputValue(input: HTMLInputElement | null, value: string) {
  if (!input) throw new Error("Falta el buscador de salones");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
