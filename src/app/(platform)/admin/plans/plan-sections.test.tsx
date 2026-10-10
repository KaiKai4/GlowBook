// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { changeFieldValue, clickElement, flushAsync, getButtonByText, getFieldByName } from "@/test/ui-admin-dom";
import { makeMetric, makeModule, makePlan } from "@/test/ui-admin-fixtures";
import { savePlanAction, savePlanLimitsAction, savePlanModulesAction } from "./actions";
import { PlanForm, PlanInfoEditor, PlanLimits, PlanModules, PlanSummary } from "./plan-sections";

vi.mock("./actions", () => ({
  savePlanAction: vi.fn(),
  savePlanModulesAction: vi.fn(),
  savePlanLimitsAction: vi.fn(),
}));

const MODULES = [
  makeModule({ key: "appointments", name: "Agenda", description: "Citas" }),
  makeModule({ key: "expenses", name: "Gastos", description: "Gastos del salón" }),
  makeModule({ key: "reports", name: "Reportes", description: "Histórico", isArchived: true }),
];

const METRICS = [
  makeMetric({ key: "appointments_monthly", moduleKey: "appointments", name: "Citas", unit: "citas", defaultCountScope: "monthly" }),
  makeMetric({ key: "customers_active", moduleKey: "appointments", name: "Clientes", unit: "", defaultCountScope: "current", counterKey: "customers_active" }),
  makeMetric({ key: "expenses_monthly", moduleKey: "expenses", name: "Gastos", unit: "gastos", counterKey: "expenses_total" }),
];

const PLAN = makePlan({
  id: "plan-pro",
  name: "Pro",
  code: "pro",
  description: "Plan completo",
  monthlyPrice: 30,
  trialDays: 14,
  status: "active",
  isPublic: true,
  sortOrder: 2,
  modules: [
    { moduleKey: "appointments", enabled: true },
    { moduleKey: "expenses", enabled: false },
  ],
  limits: [
    { metricKey: "appointments_monthly", maxValue: 100, enforcementMode: "block", warningThreshold: 90, countScope: "monthly" },
    { metricKey: "expenses_monthly", maxValue: 5, enforcementMode: "warn", warningThreshold: 80, countScope: "monthly" },
  ],
});

describe("plan-sections", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(savePlanAction).mockReset();
    vi.mocked(savePlanModulesAction).mockReset();
    vi.mocked(savePlanLimitsAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  describe("PlanInfoEditor", () => {
    it("resume precio, trial, estado y salones asignados antes del formulario", () => {
      mounted = mountComponent(<PlanInfoEditor plan={PLAN} assignedSalons={3} />);

      const text = mounted.container.textContent ?? "";
      expect(text).toContain("USD 30.00");
      expect(text).toContain("14 días");
      expect(text).toContain("Activo");
      expect(text).toContain("3");
      expect(text).toContain("Información del plan");
    });
  });

  describe("PlanForm", () => {
    it("en modo creación muestra valores por defecto y el botón Crear plan", () => {
      mounted = mountComponent(<PlanForm plan={null} />);

      expect(mounted.container.textContent).toContain("Nuevo plan");
      expect(mounted.container.querySelector('input[name="id"]')).toBeNull();
      expect(getFieldByName<HTMLInputElement>(mounted.container, "name").value).toBe("");
      expect(getFieldByName<HTMLInputElement>(mounted.container, "currency").value).toBe("USD");
      expect(getFieldByName<HTMLInputElement>(mounted.container, "status").value).toBe("draft");
      expect(getFieldByName<HTMLInputElement>(mounted.container, "isPublic").type).toBe("checkbox");
      expect(getButtonByText(mounted.container, "Crear plan").textContent).toContain("Crear plan");
    });

    it("en modo edición precarga el plan y envía su ID oculto", async () => {
      vi.mocked(savePlanAction).mockResolvedValue({ ok: true, message: "Guardado" });
      mounted = mountComponent(<PlanForm plan={PLAN} />);

      expect(getFieldByName<HTMLInputElement>(mounted.container, "name").value).toBe("Pro");
      expect(getFieldByName<HTMLInputElement>(mounted.container, "trialDays").value).toBe("14");
      expect(getFieldByName<HTMLInputElement>(mounted.container, "status").value).toBe("active");
      expect((getFieldByName<HTMLInputElement>(mounted.container, "isPublic")).checked).toBe(true);

      clickElement(getButtonByText(mounted.container, "Guardar cambios"));
      await flushAsync();

      const [, formData] = vi.mocked(savePlanAction).mock.calls[0]!;
      expect(formData.get("id")).toBe("plan-pro");
      expect(formData.get("name")).toBe("Pro");
      expect(formData.get("monthlyPrice")).toBe("30");
      expect(mounted.container.textContent).toContain("Guardado");
    });

    it("muestra el mensaje de error devuelto por la acción de guardado", async () => {
      vi.mocked(savePlanAction).mockResolvedValue({ ok: false, message: "El nombre es obligatorio." });
      mounted = mountComponent(<PlanForm plan={null} />);

      changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "name"), "Básico");
      clickElement(getButtonByText(mounted.container, "Crear plan"));
      await flushAsync();

      expect(vi.mocked(savePlanAction)).toHaveBeenCalled();
      expect(mounted.container.textContent).toContain("El nombre es obligatorio.");
    });
  });

  describe("PlanModules", () => {
    it("lista solo los módulos no archivados con su estado inicial del plan", () => {
      mounted = mountComponent(<PlanModules plan={PLAN} modules={MODULES} />);

      const checkboxes = Array.from(mounted.container.querySelectorAll<HTMLInputElement>('input[name="enabledModuleKeys"]'));
      expect(checkboxes.map((input) => input.value)).toEqual(["appointments", "expenses"]);
      expect(checkboxes.map((input) => input.checked)).toEqual([true, false]);
      expect(mounted.container.textContent).not.toContain("Reportes");
      const allKeys = Array.from(mounted.container.querySelectorAll<HTMLInputElement>('input[name="allModuleKeys"]'));
      expect(allKeys.map((input) => input.value)).toEqual(["appointments", "expenses"]);
    });

    it("envía todos los módulos visibles y solo los marcados como habilitados", async () => {
      vi.mocked(savePlanModulesAction).mockResolvedValue({ ok: true, message: "Módulos guardados" });
      mounted = mountComponent(<PlanModules plan={PLAN} modules={MODULES} />);

      clickElement(mounted.container.querySelector<HTMLInputElement>('input[name="enabledModuleKeys"][value="expenses"]')!);
      clickElement(getButtonByText(mounted.container, "Guardar módulos"));
      await flushAsync();

      const [, formData] = vi.mocked(savePlanModulesAction).mock.calls[0]!;
      expect(formData.get("planId")).toBe("plan-pro");
      expect(formData.getAll("allModuleKeys")).toEqual(["appointments", "expenses"]);
      expect(formData.getAll("enabledModuleKeys")).toEqual(["appointments", "expenses"]);
      expect(mounted.container.textContent).toContain("Módulos guardados");
    });
  });

  describe("PlanLimits", () => {
    it("pide activar módulos cuando el plan no tiene ninguno habilitado", () => {
      mounted = mountComponent(
        <PlanLimits plan={makePlan({ modules: [{ moduleKey: "appointments", enabled: false }], limits: [] })} metrics={METRICS} modules={MODULES} />
      );

      expect(mounted.container.textContent).toContain("Este plan no tiene módulos activos.");
      expect(mounted.container.querySelector("form")).toBeNull();
    });

    it("muestra solo los límites de módulos incluidos y avisa de los módulos excluidos", () => {
      mounted = mountComponent(<PlanLimits plan={PLAN} metrics={METRICS} modules={MODULES} />);

      const text = mounted.container.textContent ?? "";
      expect(text).toContain("Agenda");
      expect(text).toContain("2 controles");
      expect(text).toContain("Módulos sin límites configurables porque no están incluidos en este plan: Gastos.");
      expect(mounted.container.querySelectorAll('input[name="metricKey"]')).toHaveLength(2);
    });

    it("precarga los valores del límite existente y usa los valores por defecto del catálogo para los nuevos", () => {
      mounted = mountComponent(<PlanLimits plan={PLAN} metrics={METRICS} modules={MODULES} />);

      const maxValues = Array.from(mounted.container.querySelectorAll<HTMLInputElement>('input[name="maxValue"]'));
      expect(maxValues.map((input) => input.value)).toEqual(["100", ""]);
      const enforcement = Array.from(mounted.container.querySelectorAll<HTMLInputElement>('input[name="enforcementMode"]'));
      expect(enforcement.map((input) => input.value)).toEqual(["block", "warn"]);
      const scopes = Array.from(mounted.container.querySelectorAll<HTMLInputElement>('input[name="countScope"]'));
      expect(scopes.map((input) => input.value)).toEqual(["monthly", "current"]);
      const thresholds = Array.from(mounted.container.querySelectorAll<HTMLInputElement>('input[name="warningThreshold"]'));
      expect(thresholds.map((input) => input.value)).toEqual(["90", "80"]);
    });

    it("envía la acción de guardado con las claves de cada límite visible", async () => {
      vi.mocked(savePlanLimitsAction).mockResolvedValue({ ok: true, message: "Límites guardados" });
      mounted = mountComponent(<PlanLimits plan={PLAN} metrics={METRICS} modules={MODULES} />);

      clickElement(getButtonByText(mounted.container, "Guardar límites"));
      await flushAsync();

      const [, formData] = vi.mocked(savePlanLimitsAction).mock.calls[0]!;
      expect(formData.get("planId")).toBe("plan-pro");
      expect(formData.getAll("metricKey")).toEqual(["appointments_monthly", "customers_active"]);
      expect(mounted.container.textContent).toContain("Límites guardados");
    });
  });

  describe("PlanSummary", () => {
    it("muestra el estado de cada módulo y los límites de los módulos activos", () => {
      mounted = mountComponent(<PlanSummary plan={PLAN} modules={MODULES} metrics={METRICS} />);

      const text = mounted.container.textContent ?? "";
      expect(text).toContain("Agenda");
      expect(text).toContain("Activo");
      expect(text).toContain("Gastos");
      expect(text).toContain("Off");
      expect(text).toContain("Citas");
      expect(text).toContain("Mes calendario · Bloqueo");
      expect(text).toContain("100 citas");
      expect(text).not.toContain("Advertencia");
    });

    it("indica que no hay límites cuando ningún módulo del plan los tiene", () => {
      mounted = mountComponent(
        <PlanSummary plan={makePlan({ modules: [], limits: [] })} modules={MODULES} metrics={METRICS} />
      );

      expect(mounted.container.textContent).toContain("Este plan aún no tiene límites en sus módulos activos.");
    });

    it("muestra 'Sin límite' cuando el máximo del límite es nulo", () => {
      mounted = mountComponent(
        <PlanSummary
          plan={makePlan({
            modules: [{ moduleKey: "appointments", enabled: true }],
            limits: [{ metricKey: "customers_active", maxValue: null, enforcementMode: "none", warningThreshold: 80, countScope: "current" }],
          })}
          modules={MODULES}
          metrics={METRICS}
        />
      );

      expect(mounted.container.textContent).toContain("Sin límite");
      expect(mounted.container.textContent).toContain("Sin control");
    });
  });
});

