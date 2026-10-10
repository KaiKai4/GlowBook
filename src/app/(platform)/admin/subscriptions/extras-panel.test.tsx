// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, getButtonByText, getFieldByName } from "@/test/ui-admin-dom";
import { CATALOG_MODULES, makeAddon, makeExtra, makeMetric } from "@/test/ui-admin-fixtures";
import { ExtrasPanel } from "./extras-panel";

vi.mock("./actions", () => ({
  cancelExtraAction: vi.fn(),
  giveAddonAction: vi.fn(),
  giveManualExtraAction: vi.fn(),
}));

const METRICS = [
  makeMetric({ key: "appointments_monthly", name: "Citas" }),
  makeMetric({ key: "customers_active", name: "Clientes", counterKey: "customers_active", unit: "clientes" }),
];

const ADDONS = [
  makeAddon({ id: "addon-citas", name: "Citas extra", kind: "limit_boost", metricKey: "appointments_monthly", monthlyPrice: 5 }),
  makeAddon({ id: "addon-agenda", name: "Módulo Agenda", kind: "module", metricKey: null, moduleKey: "appointments", limitDelta: null, monthlyPrice: 9 }),
];

function renderPanel(overrides: Partial<Parameters<typeof ExtrasPanel>[0]> = {}): MountedComponent {
  return mountComponent(
    <ExtrasPanel
      salonId="salon-1"
      extras={[]}
      addons={ADDONS}
      metrics={METRICS}
      modules={CATALOG_MODULES}
      {...overrides}
    />
  );
}

describe("ExtrasPanel", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("indica que el salón no tiene extras vigentes cuando la lista está vacía", () => {
    mounted = renderPanel();

    expect(mounted.container.textContent).toContain("Este salón no tiene extras vigentes.");
  });

  it("muestra cada extra con precio, regalo, cantidad, vencimiento y motivo", () => {
    mounted = renderPanel({
      extras: [
        makeExtra({ id: "e1", name: "Citas extra", quantity: 2, monthlyPrice: 10, endsAt: "2026-12-31", reason: "Promo" }),
        makeExtra({ id: "e2", name: "Módulo Gastos", isGift: true, monthlyPrice: 0, detail: "Módulo", reason: "" }),
      ],
    });

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Citas extra × 2");
    expect(text).toContain("USD 10.00/mes");
    expect(text).toContain("vence 2026-12-31");
    expect(text).toContain("Promo");
    expect(text).toContain("Módulo Gastos");
    expect(text).toContain("Regalo");
    expect(mounted.container.querySelector('[aria-label="Cancelar Citas extra"]')).not.toBeNull();
    expect(mounted.container.querySelector('[aria-label="Cancelar Módulo Gastos"]')).not.toBeNull();
  });

  it("explica que el extra del catálogo ya está seleccionado cuando el límite tiene uno", () => {
    mounted = renderPanel({ suggestedMetricKey: "appointments_monthly" });

    expect(mounted.container.textContent).toContain("Estas ampliando Citas.");
    expect(mounted.container.textContent).toContain("El extra del catálogo que lo aumenta ya está seleccionado");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "addonId").value).toBe("addon-citas");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "metricKey").value).toBe("");
  });

  it("preselecciona el límite en la cortesía cuando no hay extra de catálogo para él", () => {
    mounted = renderPanel({ suggestedMetricKey: "customers_active" });

    expect(mounted.container.textContent).toContain("No hay un extra de catálogo para este límite");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "metricKey").value).toBe("customers_active");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "addonId").value).toBe("addon-citas");
  });

  it("no muestra banner cuando la métrica sugerida no existe en el catálogo", () => {
    mounted = renderPanel({ suggestedMetricKey: "metrica_inexistente" });

    expect(mounted.container.textContent).not.toContain("Estas ampliando");
  });

  it("muestra la cantidad solo para extras de tipo límite y oculta el precio especial al regalar", () => {
    mounted = renderPanel();

    expect(mounted.container.querySelector('input[name="quantity"]')).not.toBeNull();
    expect(mounted.container.querySelector('input[name="priceOverride"]')).not.toBeNull();
    expect(getButtonByText(mounted.container, "Asignar extra")).toBeTruthy();

    const gift = mounted.container.querySelector<HTMLInputElement>('input[name="isGift"]');
    clickElement(gift!);

    expect(mounted.container.querySelector('input[name="priceOverride"]')).toBeNull();
    expect(getButtonByText(mounted.container, "Regalar extra")).toBeTruthy();
  });

  it("oculta la cantidad cuando el extra seleccionado es un módulo", () => {
    mounted = renderPanel({ suggestedMetricKey: null });
    const addonSelect = getFieldByName<HTMLSelectElement>(mounted.container, "addonId");
    expect(addonSelect.value).toBe("addon-citas");

    clickElement(getButtonByText(mounted.container, "Citas extra — USD"));
    clickElement(
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) =>
        option.textContent?.includes("Módulo Agenda")
      )!
    );

    expect(getFieldByName<HTMLSelectElement>(mounted.container, "addonId").value).toBe("addon-agenda");
    expect(mounted.container.querySelector('input[name="quantity"]')).toBeNull();
  });

  it("cambia la cortesía de límite a módulo y reemplaza el campo de métrica", () => {
    mounted = renderPanel();
    expect(mounted.container.querySelector('input[name="maxDelta"]')).not.toBeNull();

    clickElement(getButtonByText(mounted.container, "Aumentar un límite"));
    clickElement(
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) =>
        option.textContent?.includes("Activar un módulo")
      )!
    );

    expect(getFieldByName<HTMLInputElement>(mounted.container, "targetType").value).toBe("module");
    expect(mounted.container.querySelector('input[name="maxDelta"]')).toBeNull();
    expect(getFieldByName<HTMLInputElement>(mounted.container, "moduleKey").value).toBe("");
  });
});
