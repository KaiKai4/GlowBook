// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { changeFieldValue, clickElement, flushAsync, getButtonByText, getFieldByName } from "@/test/ui-admin-dom";
import { makeAddon, makeMetric, makeModule } from "@/test/ui-admin-fixtures";
import { removeAddonAction, saveAddonAction } from "./actions";
import { AddonsCatalog } from "./addons-catalog";

vi.mock("./actions", () => ({
  saveAddonAction: vi.fn(),
  removeAddonAction: vi.fn(),
}));

const MODULES = [
  makeModule({ key: "appointments", name: "Agenda" }),
  makeModule({ key: "reports", name: "Reportes", isArchived: true }),
];

const METRICS = [
  makeMetric({ key: "appointments_monthly", name: "Citas" }),
  makeMetric({ key: "customers_active", name: "Clientes (archivado)", isArchived: true }),
];

const MODULE_ADDON = makeAddon({
  id: "addon-agenda",
  name: "Módulo Agenda",
  code: "agenda",
  description: "Activa la agenda",
  kind: "module",
  moduleKey: "appointments",
  metricKey: null,
  limitDelta: null,
  monthlyPrice: 9,
  status: "active",
});

const LIMIT_ADDON = makeAddon({
  id: "addon-citas",
  name: "Bloque de citas",
  code: "citas_1000",
  description: "",
  kind: "limit_boost",
  moduleKey: null,
  metricKey: "appointments_monthly",
  limitDelta: 1000,
  monthlyPrice: 5,
  status: "draft",
});

function renderCatalog(addons = [MODULE_ADDON, LIMIT_ADDON]): MountedComponent {
  return mountComponent(<AddonsCatalog data={{ addons, modules: MODULES, metrics: METRICS }} />);
}

describe("AddonsCatalog", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(saveAddonAction).mockReset();
    vi.mocked(removeAddonAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("lista los extras con precio, tipo y estado, y cuenta los activos", () => {
    mounted = renderCatalog();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("2 en catálogo");
    expect(text).toContain("1 activos");
    expect(text).toContain("USD 9.00/mes · Módulo");
    expect(text).toContain("USD 5.00/mes · Límite");
    expect(text).toContain("Borrador");
  });

  it("muestra el primer extra seleccionado con su código y descripción", () => {
    mounted = renderCatalog();

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Módulo Agenda");
    expect(mounted.container.textContent).toContain("agenda");
    expect(mounted.container.textContent).toContain("Activa la agenda");
    expect(getButtonByText(mounted.container, "Eliminar").textContent).toContain("Eliminar");
  });

  it("usa el texto guía cuando el extra no tiene descripción", () => {
    mounted = renderCatalog();

    clickElement(getButtonByText(mounted.container, "Bloque de citas"));

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Bloque de citas");
    expect(mounted.container.textContent).toContain("Extra vendible o regalable por salón.");
  });

  it("cambia el formulario al extra elegido y precarga sus valores", () => {
    mounted = renderCatalog();
    clickElement(getButtonByText(mounted.container, "Bloque de citas"));

    expect(getFieldByName<HTMLInputElement>(mounted.container, "name").value).toBe("Bloque de citas");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "kind").value).toBe("limit_boost");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "metricKey").value).toBe("appointments_monthly");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "limitDelta").value).toBe("1000");
    expect(mounted.container.querySelector('input[name="id"]')?.getAttribute("value")).toBe("addon-citas");
  });

  it("muestra el aviso de catálogo vacío y abre el formulario de creación", () => {
    mounted = renderCatalog([]);

    expect(mounted.container.textContent).toContain("Crea el primer extra para venderlo o regalarlo a salones.");
    expect(mounted.container.textContent).toContain("0 en catálogo");
    expect(mounted.container.textContent).toContain("Nuevo extra");
    expect(mounted.container.querySelector("h2")?.textContent).toBe("Nuevo extra");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "kind").value).toBe("module");
  });

  it("al pulsar Nuevo extra oculta el botón Eliminar y limpia el formulario", () => {
    mounted = renderCatalog();

    clickElement(getButtonByText(mounted.container, "Nuevo extra"));

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Nuevo extra");
    expect(mounted.container.textContent).not.toContain("Eliminar");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "name").value).toBe("");
    expect(mounted.container.querySelector('input[name="id"]')).toBeNull();
    expect(getButtonByText(mounted.container, "Crear extra").textContent).toContain("Crear extra");
  });

  it("según el tipo elegido muestra el selector de módulo o el de límite y el campo de cantidad", () => {
    mounted = renderCatalog([]);

    expect(mounted.container.querySelector('select[name="moduleKey"], input[name="moduleKey"]')).not.toBeNull();
    expect(mounted.container.querySelector('input[name="limitDelta"]')).toBeNull();

    clickElement(getButtonByText(mounted.container, "Activa un módulo"));
    clickElement(
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) =>
        option.textContent?.includes("Aumenta un límite")
      )!
    );

    expect(getFieldByName<HTMLInputElement>(mounted.container, "metricKey").value).toBe("");
    expect(mounted.container.querySelector('input[name="limitDelta"]')).not.toBeNull();
  });

  it("solo ofrece módulos y límites no archivados al crear un extra", () => {
    mounted = renderCatalog([]);

    clickElement(getButtonByText(mounted.container, "Selecciona un módulo"));
    const moduleOptions = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).map((o) => o.textContent);
    expect(moduleOptions).toContain("Agenda");
    expect(moduleOptions).not.toContain("Reportes");
  });

  it("envía el extra con su ID al guardar y muestra el resultado", async () => {
    vi.mocked(saveAddonAction).mockResolvedValue({ ok: true, message: "Extra guardado" });
    mounted = renderCatalog();

    clickElement(getButtonByText(mounted.container, "Guardar cambios"));
    await flushAsync();

    const [, formData] = vi.mocked(saveAddonAction).mock.calls[0]!;
    expect(formData.get("id")).toBe("addon-agenda");
    expect(formData.get("name")).toBe("Módulo Agenda");
    expect(formData.get("kind")).toBe("module");
    expect(mounted.container.textContent).toContain("Extra guardado");
  });

  it("muestra el error de validación del formulario sin cerrarlo", async () => {
    vi.mocked(saveAddonAction).mockResolvedValue({ ok: false, message: "Selecciona un módulo para el extra." });
    mounted = renderCatalog([]);

    changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "name"), "Extra sin módulo");
    clickElement(getButtonByText(mounted.container, "Crear extra"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("Selecciona un módulo para el extra.");
    expect(getButtonByText(mounted.container, "Crear extra")).toBeTruthy();
  });
});
