// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, getButtonByText } from "@/test/ui-admin-dom";
import { makeMetric, makePlan } from "@/test/ui-admin-fixtures";
import { PlansWorkspace } from "./plans-workspace";

vi.mock("./actions", () => ({ archivePlanAction: vi.fn(), deletePlanAction: vi.fn() }));

// Los editores de cada pestaña tienen su propio test: aquí solo se comprueba
// qué editor recibe el plan seleccionado.
vi.mock("./plan-sections", async () => {
  const React = await import("react");
  const stub = (label: string) => {
    function EditorStub({ plan }: { plan?: { name: string } | null }) {
      return React.createElement("div", { "data-editor": label }, plan ? `${label}:${plan.name}` : `${label}:nuevo`);
    }
    return EditorStub;
  };
  return {
    PlanForm: stub("form"),
    PlanInfoEditor: stub("info"),
    PlanModules: stub("modules"),
    PlanLimits: stub("limits"),
    PlanSummary: stub("summary"),
  };
});

const METRICS = [
  makeMetric({ key: "appointments_monthly", moduleKey: "appointments", name: "Citas" }),
  makeMetric({ key: "expenses_monthly", moduleKey: "expenses", name: "Gastos", counterKey: "expenses_total" }),
];

const PRO = makePlan({
  id: "plan-pro",
  code: "pro",
  name: "Pro",
  description: "Para salones en crecimiento",
  monthlyPrice: 30,
  status: "active",
  modules: [
    { moduleKey: "appointments", enabled: true },
    { moduleKey: "expenses", enabled: false },
  ],
  limits: [
    { metricKey: "appointments_monthly", maxValue: 100, enforcementMode: "block", warningThreshold: 80, countScope: "monthly" },
    { metricKey: "expenses_monthly", maxValue: 10, enforcementMode: "warn", warningThreshold: 80, countScope: "monthly" },
  ],
});

const BASICO = makePlan({
  id: "plan-basico",
  code: "basico",
  name: "Básico",
  description: "",
  monthlyPrice: 12,
  status: "draft",
  modules: [],
  limits: [],
});

function renderWorkspace(overrides: Partial<Parameters<typeof PlansWorkspace>[0]["data"]> = {}, startInCreateMode = false): MountedComponent {
  return mountComponent(
    <PlansWorkspace
      startInCreateMode={startInCreateMode}
      data={{
        modules: [],
        metrics: METRICS,
        plans: [PRO, BASICO],
        assignmentsByPlan: { "plan-pro": 2, "plan-basico": 0 },
        ...overrides,
      }}
    />
  );
}

describe("PlansWorkspace", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("lista los planes con precio, salones asignados y estado, y cuenta los activos", () => {
    mounted = renderWorkspace();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("2 registrados");
    expect(text).toContain("1 activos");
    expect(text).toContain("USD 30.00/mes · 2 salones");
    expect(text).toContain("USD 12.00/mes · 0 salones");
    expect(text).toContain("Borrador");
  });

  it("abre en el primer plan con su código, descripción y salones asignados", () => {
    mounted = renderWorkspace();

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Pro");
    expect(mounted.container.textContent).toContain("pro");
    expect(mounted.container.textContent).toContain("Para salones en crecimiento");
    expect(mounted.container.textContent).toContain("2 salones asignados");
    expect(mounted.container.querySelector('[data-editor="info"]')?.textContent).toBe("info:Pro");
  });

  it("muestra el texto guía cuando el plan no tiene descripción y singulariza el contador", () => {
    mounted = renderWorkspace({ assignmentsByPlan: { "plan-pro": 1 } });
    expect(mounted.container.textContent).toContain("1 salón asignado");

    clickElement(getButtonByText(mounted.container, "Básico"));

    expect(mounted.container.textContent).toContain("Configura información, módulos y límites de este plan.");
    expect(mounted.container.textContent).not.toContain("salón asignado");
  });

  it("indica que se archivará cuando el plan tiene salones asignados y que se eliminará si no los tiene", () => {
    mounted = renderWorkspace();
    expect(getButtonByText(mounted.container, "Archivar").textContent).toContain("Archivar");

    clickElement(getButtonByText(mounted.container, "Básico"));
    expect(getButtonByText(mounted.container, "Eliminar").textContent).toContain("Eliminar");
  });

  it("cuenta en la pestaña Módulos solo los habilitados y en Límites solo los de módulos activos", () => {
    mounted = renderWorkspace();

    const tabs = Array.from(mounted.container.querySelectorAll("button")).map((button) => button.textContent ?? "");
    const modulesTab = tabs.find((text) => text.startsWith("Módulos"));
    const limitsTab = tabs.find((text) => text.startsWith("Límites"));
    expect(modulesTab).toBe("Módulos1");
    // Solo el límite de citas cuenta: el de gastos pertenece a un módulo desactivado.
    expect(limitsTab).toBe("Límites1");
  });

  it("cambia el editor mostrado al elegir cada pestaña del plan", () => {
    mounted = renderWorkspace();

    clickElement(getButtonByText(mounted.container, "Módulos"));
    expect(mounted.container.querySelector("[data-editor]")?.getAttribute("data-editor")).toBe("modules");

    clickElement(getButtonByText(mounted.container, "Límites"));
    expect(mounted.container.querySelector("[data-editor]")?.getAttribute("data-editor")).toBe("limits");

    clickElement(getButtonByText(mounted.container, "Resumen"));
    expect(mounted.container.querySelector("[data-editor]")?.getAttribute("data-editor")).toBe("summary");
  });

  it("vuelve a la pestaña Información al seleccionar otro plan", () => {
    mounted = renderWorkspace();
    clickElement(getButtonByText(mounted.container, "Módulos"));

    clickElement(getButtonByText(mounted.container, "Básico"));

    expect(mounted.container.querySelector("[data-editor]")?.getAttribute("data-editor")).toBe("info");
    expect(mounted.container.querySelector("h2")?.textContent).toBe("Básico");
  });

  it("muestra el formulario de creación al pulsar Nuevo plan", () => {
    mounted = renderWorkspace();

    clickElement(mounted.container.querySelector<HTMLButtonElement>("#new-plan")!);

    expect(mounted.container.querySelector("[data-editor]")?.textContent).toBe("form:nuevo");
    expect(mounted.container.querySelector("h2")).toBeNull();
  });

  it("empieza en modo creación cuando se solicita, aunque existan planes", () => {
    mounted = renderWorkspace({}, true);

    expect(mounted.container.querySelector("[data-editor]")?.textContent).toBe("form:nuevo");
  });

  it("invita a crear el primer plan cuando no hay ninguno", () => {
    mounted = renderWorkspace({ plans: [], assignmentsByPlan: {} });

    expect(mounted.container.textContent).toContain("Crea el primer plan para comenzar.");
    expect(mounted.container.textContent).toContain("0 registrados");
    expect(mounted.container.querySelector("[data-editor]")?.textContent).toBe("form:nuevo");
  });
});
