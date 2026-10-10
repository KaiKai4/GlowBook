// @vitest-environment jsdom
import type { ChangeEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SalonBusinessDay } from "@/features/salon/use-cases/get-salon-settings";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buttonWithAriaLabel,
  buttonWithText,
  click,
  fieldByLabel,
  flushAsync,
  setFieldValue,
} from "@/test/ui-people-dom";
import {
  updateBusinessHoursAction,
  updateSalonBgAction,
  updateSalonInfoAction,
  updateSalonPaymentMethodsAction,
  updateSalonThemeAction,
} from "./actions";
import { useUnsavedChanges } from "@/components/layout/unsaved-changes";
import { SalonSettings } from "./salon-settings";

vi.mock("./actions", () => ({
  updateSalonInfoAction: vi.fn(),
  updateBusinessHoursAction: vi.fn(),
  updateSalonThemeAction: vi.fn(),
  updateSalonBgAction: vi.fn(),
  updateSalonPaymentMethodsAction: vi.fn(),
}));

vi.mock("@/components/layout/unsaved-changes", () => ({
  useUnsavedChanges: vi.fn(),
}));

// Doble mínimo del selector de hora: un input con el mismo aria-label y contrato onChange(valor).
vi.mock("@/components/ui/time-picker", async () => {
  const { createElement } = await import("react");
  return {
    TimePicker: ({
      value,
      onChange,
      ariaLabel,
    }: {
      value: string;
      onChange: (next: string) => void;
      ariaLabel: string;
    }) =>
      createElement("input", {
        "aria-label": ariaLabel,
        value,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
      }),
  };
});

function weekHours(): SalonBusinessDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    is_open: day < 5,
    open_time: "09:00",
    close_time: "18:00",
  }));
}

interface RenderOptions {
  salonName?: string;
  theme?: string;
  bgStyle?: string;
  paymentMethods?: string[];
  businessHours?: SalonBusinessDay[];
}

function renderSettings(options: RenderOptions = {}): MountedComponent {
  return mountComponent(
    <SalonSettings
      salonName={options.salonName ?? "Salón Lumière"}
      timezone="America/Panama"
      theme={options.theme ?? "violet"}
      bgStyle={options.bgStyle ?? "neutral"}
      paymentMethods={options.paymentMethods ?? ["Efectivo", "Tarjeta"]}
      businessHours={options.businessHours ?? weekHours()}
    />
  );
}

function dirtyFlagCalls(): boolean[] {
  return vi.mocked(useUnsavedChanges).mock.calls.map(([dirty]) => dirty);
}

describe("SalonSettings", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(updateSalonInfoAction).mockReset();
    vi.mocked(updateBusinessHoursAction).mockReset();
    vi.mocked(updateSalonThemeAction).mockReset();
    vi.mocked(updateSalonBgAction).mockReset();
    vi.mocked(updateSalonPaymentMethodsAction).mockReset();
    vi.mocked(useUnsavedChanges).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.querySelectorAll("[data-theme], [data-bg]").forEach((element) => element.remove());
  });

  it("muestra el encabezado, el enlace al log de actividad y la zona horaria", () => {
    mounted = renderSettings();

    expect(mounted.container.querySelector("h1")?.textContent).toContain("Configuración del salón");
    const activity = mounted.container.querySelector<HTMLAnchorElement>('a[href="/salon/actividad"]');
    expect(activity?.textContent).toContain("Log de actividad");
    expect(mounted.container.textContent).toContain("Zona horaria: America/Panama");
  });

  it("lista los siete días con su estado de apertura", () => {
    mounted = renderSettings();

    const text = mounted.container.textContent ?? "";
    for (const day of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]) {
      expect(text).toContain(day);
    }
    const toggles = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>("button")).map((b) => b.textContent);
    expect(toggles.filter((label) => label === "Abierto")).toHaveLength(5);
    expect(toggles.filter((label) => label === "Cerrado")).toHaveLength(2);
  });

  it("marca cambios sin guardar solo cuando el nombre difiere del guardado", () => {
    mounted = renderSettings();
    expect(dirtyFlagCalls().at(-1)).toBe(false);

    setFieldValue(fieldByLabel(mounted.container, "Nombre del salón"), "Salón Nuevo");

    expect(dirtyFlagCalls().at(-1)).toBe(true);
  });

  it("guarda el nombre con FormData y muestra la confirmación", async () => {
    vi.mocked(updateSalonInfoAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderSettings();

    setFieldValue(fieldByLabel(mounted.container, "Nombre del salón"), "Salón Nuevo");
    click(buttonWithText(mounted.container, "Guardar nombre"));
    await flushAsync();

    const [previous, formData] = vi.mocked(updateSalonInfoAction).mock.calls[0] ?? [];
    expect(previous).toBeNull();
    expect(formData?.get("name")).toBe("Salón Nuevo");
    expect(mounted.container.textContent).toContain("Guardado");
    expect(dirtyFlagCalls().at(-1)).toBe(false);
  });

  it("muestra el error de guardado del nombre sin marcarlo como guardado", async () => {
    vi.mocked(updateSalonInfoAction).mockResolvedValue({ ok: false, error: "El nombre ya está en uso" });
    mounted = renderSettings();

    click(buttonWithText(mounted.container, "Guardar nombre"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("El nombre ya está en uso");
    expect(mounted.container.textContent).not.toContain("Guardado");
  });

  it("agrega un método de pago normalizando espacios y lo incluye al guardar", async () => {
    vi.mocked(updateSalonPaymentMethodsAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderSettings();

    const input = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Escribe un método, ej. Zinli"]');
    if (!input) throw new Error("falta el campo de método de pago");
    setFieldValue(input, "  Zinli   móvil ");
    click(buttonWithText(mounted.container, "Agregar"));
    click(buttonWithText(mounted.container, "Guardar métodos"));
    await flushAsync();

    expect(updateSalonPaymentMethodsAction).toHaveBeenCalledWith(["Efectivo", "Tarjeta", "Zinli móvil"]);
    expect(mounted.container.textContent).toContain("Métodos actualizados");
  });

  it("rechaza métodos vacíos, duplicados sin importar mayúsculas y nombres demasiado largos", () => {
    mounted = renderSettings();
    const input = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Escribe un método, ej. Zinli"]');
    if (!input) throw new Error("falta el campo de método de pago");

    setFieldValue(input, "   ");
    click(buttonWithText(mounted.container, "Agregar"));
    expect(mounted.container.textContent).toContain("Escribe un método de pago.");

    setFieldValue(input, "efectivo");
    click(buttonWithText(mounted.container, "Agregar"));
    expect(mounted.container.textContent).toContain("Ese método de pago ya esta en la lista.");

    setFieldValue(input, "x".repeat(65));
    click(buttonWithText(mounted.container, "Agregar"));
    expect(mounted.container.textContent).toContain("El método de pago no puede superar 64 caracteres.");
  });

  it("quita un método de pago de la lista antes de guardar", () => {
    mounted = renderSettings();

    click(buttonWithAriaLabel(mounted.container, "Quitar Tarjeta"));

    expect(mounted.container.textContent).not.toContain("Tarjeta");
    expect(mounted.container.textContent).toContain("Efectivo");
  });

  it("exige al menos un método de pago antes de guardar", () => {
    mounted = renderSettings({ paymentMethods: ["Efectivo"] });

    click(buttonWithAriaLabel(mounted.container, "Quitar Efectivo"));
    click(buttonWithText(mounted.container, "Guardar métodos"));

    expect(mounted.container.textContent).toContain("Agrega al menos un método de pago.");
    expect(updateSalonPaymentMethodsAction).not.toHaveBeenCalled();
  });

  it("alterna un día entre abierto y cerrado y muestra sus horarios solo cuando está abierto", () => {
    mounted = renderSettings();

    expect(mounted.container.querySelector('input[aria-label="Hora de apertura del Sábado"]')).toBeNull();

    click(buttonWithText(mounted.container, "Cerrado"));

    expect(mounted.container.querySelector('input[aria-label="Hora de apertura del Sábado"]')).not.toBeNull();
  });

  it("rechaza guardar horarios cuando la hora de cierre no es posterior a la de apertura", () => {
    mounted = renderSettings();

    setFieldValue(
      mounted.container.querySelector<HTMLInputElement>('input[aria-label="Hora de apertura del Martes"]') ?? missing(),
      "19:00"
    );
    click(buttonWithText(mounted.container, "Guardar horarios"));

    expect(mounted.container.textContent).toContain(
      "Martes: la hora de cierre debe ser mayor que la de apertura."
    );
    expect(updateBusinessHoursAction).not.toHaveBeenCalled();
  });

  it("guarda los horarios válidos serializados como JSON", async () => {
    vi.mocked(updateBusinessHoursAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderSettings();

    setFieldValue(
      mounted.container.querySelector<HTMLInputElement>('input[aria-label="Hora de cierre del Lunes"]') ?? missing(),
      "20:00"
    );
    click(buttonWithText(mounted.container, "Guardar horarios"));
    await flushAsync();

    expect(updateBusinessHoursAction).toHaveBeenCalledTimes(1);
    const sent: SalonBusinessDay[] = JSON.parse(vi.mocked(updateBusinessHoursAction).mock.calls[0]?.[0] ?? "[]");
    expect(sent).toHaveLength(7);
    expect(sent[0]).toEqual({ day_of_week: 0, is_open: true, open_time: "09:00", close_time: "20:00" });
    expect(sent[5]?.is_open).toBe(false);
    expect(mounted.container.textContent).toContain("Horarios actualizados");
  });

  it("muestra el error del servidor al guardar horarios", async () => {
    vi.mocked(updateBusinessHoursAction).mockResolvedValue({ ok: false, error: "No se pudieron guardar los horarios" });
    mounted = renderSettings();

    click(buttonWithText(mounted.container, "Guardar horarios"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("No se pudieron guardar los horarios");
  });

  it("aplica el nuevo tema al instante y lo envía al servidor", async () => {
    vi.mocked(updateSalonThemeAction).mockResolvedValue({ ok: true, value: undefined });
    const panel = document.createElement("div");
    panel.setAttribute("data-theme", "violet");
    document.body.appendChild(panel);
    mounted = renderSettings({ theme: "violet" });

    click(buttonWithText(mounted.container, "Rosewater"));
    await flushAsync();

    expect(updateSalonThemeAction).toHaveBeenCalledWith("rosewater");
    expect(panel.getAttribute("data-theme")).toBe("rosewater");
  });

  it("no vuelve a llamar al servidor al elegir el tema que ya está activo", () => {
    mounted = renderSettings({ theme: "violet" });

    click(buttonWithText(mounted.container, "Violeta"));

    expect(updateSalonThemeAction).not.toHaveBeenCalled();
  });

  it("revierte el tema y muestra el error cuando el servidor lo rechaza", async () => {
    vi.mocked(updateSalonThemeAction).mockResolvedValue({ ok: false, error: "Tema no disponible" });
    const panel = document.createElement("div");
    panel.setAttribute("data-theme", "violet");
    document.body.appendChild(panel);
    mounted = renderSettings({ theme: "violet" });

    click(buttonWithText(mounted.container, "Mocco"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("Tema no disponible");
    expect(panel.getAttribute("data-theme")).toBe("violet");
  });

  it("cambia el fondo del panel y revierte si el servidor falla", async () => {
    vi.mocked(updateSalonBgAction).mockResolvedValue({ ok: false, error: "Fondo no disponible" });
    mounted = renderSettings({ bgStyle: "neutral" });

    click(buttonWithText(mounted.container, "De color"));
    expect(updateSalonBgAction).toHaveBeenCalledWith("colored");
    await flushAsync();

    expect(mounted.container.textContent).toContain("Fondo no disponible");
  });

  it("muestra cada gama con sus tokens de marca, sin estilos ni colores literales", () => {
    mounted = renderSettings();
    const swatches = mounted.container.querySelectorAll<HTMLElement>("[data-theme-preview]");

    expect([...swatches].map((el) => el.dataset.theme)).toEqual([
      "violet",
      "mocco",
      "tiffany",
      "viridian",
      "yellow",
      "rosewater",
    ]);
    for (const swatch of swatches) {
      expect(swatch.querySelectorAll('span[class*="bg-brand-"]')).toHaveLength(4);
      expect(swatch.querySelector("[style]")).toBeNull();
      expect(swatch.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });

  it("aplica el tema a la raíz del panel sin modificar las muestras de la gama", async () => {
    vi.mocked(updateSalonThemeAction).mockResolvedValue({ ok: true, value: undefined });
    const panel = document.createElement("div");
    panel.setAttribute("data-theme", "violet");
    document.body.appendChild(panel);
    mounted = renderSettings({ theme: "violet" });

    click(buttonWithText(mounted.container, "Rosewater"));
    await flushAsync();

    expect(panel.getAttribute("data-theme")).toBe("rosewater");
    expect(mounted.container.querySelector('[data-theme-preview][data-theme="mocco"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-theme-preview][data-theme="violet"]')).not.toBeNull();
  });
});

function missing(): never {
  throw new Error("falta un campo esperado en el formulario de horarios");
}
