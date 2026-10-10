// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCurrency } from "@/infra/format/money";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { chooseOption, click } from "@/test/ui-appointments-dom";
import {
  SALON_TZ,
  TEST_DATE,
  WIZARD_CATEGORIES,
  WIZARD_EMPLOYEES,
  WIZARD_SERVICES,
} from "@/test/ui-appointments-fixtures";
import {
  AppointmentEditServiceRow,
  type AppointmentEditServiceRowProps,
} from "./appointment-edit-service-row";

function buildProps(
  overrides: Partial<AppointmentEditServiceRowProps> = {}
): AppointmentEditServiceRowProps {
  return {
    index: 0,
    row: { key: "row-1", categoryId: "cat-cabello", serviceId: "svc-corte", employeeId: "emp-1" },
    item: undefined,
    categories: WIZARD_CATEGORIES,
    services: WIZARD_SERVICES,
    candidates: WIZARD_EMPLOYEES,
    timezone: SALON_TZ,
    isDragging: false,
    canRemove: true,
    loadingAvailability: false,
    onDragStart: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
    onRemove: vi.fn(),
    onUpdate: vi.fn(),
    ...overrides,
  };
}

function rootOf(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("La fila no se renderizó");
  return root;
}

describe("AppointmentEditServiceRow", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el número de servicio, el horario calculado y el importe del servicio", () => {
    const item = {
      row: { key: "row-1", categoryId: "cat-cabello", serviceId: "svc-corte", employeeId: "emp-1" },
      service: WIZARD_SERVICES[0],
      start: new Date(`${TEST_DATE}T19:00:00Z`),
      end: new Date(`${TEST_DATE}T20:00:00Z`),
    };
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps({ item })} />);

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Servicio 1");
    expect(text).toContain(formatCurrency(25));
  });

  it("no muestra el botón de quitar cuando la fila es la única", () => {
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps({ canRemove: false })} />);

    expect(mounted.container.querySelector('[aria-label="Quitar servicio"]')).toBeNull();
  });

  it("llama a onRemove al pulsar quitar servicio", () => {
    const onRemove = vi.fn();
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps({ onRemove })} />);

    click(mounted.container.querySelector('[aria-label="Quitar servicio"]') as HTMLElement);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("resalta la tarjeta mientras se arrastra y usa la sombra suave en reposo", () => {
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps({ isDragging: true })} />);
    expect(rootOf(mounted.container).className).toContain("border-brand-400");
    expect(rootOf(mounted.container).className).toContain("shadow-focus");

    mounted.unmount();
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps()} />);
    expect(rootOf(mounted.container).className).toContain("border-brand-100");
    expect(rootOf(mounted.container).className).toContain("shadow-hairline");
  });

  it("delega los eventos de arrastre en los manejadores recibidos", () => {
    const handlers = { onDragStart: vi.fn(), onDrop: vi.fn(), onDragEnd: vi.fn() };
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps(handlers)} />);
    const root = rootOf(mounted.container);

    root.dispatchEvent(new Event("dragstart", { bubbles: true }));
    root.dispatchEvent(new Event("drop", { bubbles: true }));
    root.dispatchEvent(new Event("dragend", { bubbles: true }));

    expect(handlers.onDragStart).toHaveBeenCalledTimes(1);
    expect(handlers.onDrop).toHaveBeenCalledTimes(1);
    expect(handlers.onDragEnd).toHaveBeenCalledTimes(1);
  });

  it("al cambiar de categoría limpia el servicio y el profesional", () => {
    const onUpdate = vi.fn();
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps({ onUpdate })} />);

    chooseOption(mounted.container, "Categoría", "Uñas");

    expect(onUpdate).toHaveBeenCalledWith({ categoryId: "cat-unas", serviceId: "", employeeId: "" });
  });

  it("al cambiar de servicio limpia el profesional", () => {
    const onUpdate = vi.fn();
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps({ onUpdate })} />);

    chooseOption(mounted.container, "Servicio", "Tinte (90 min)");

    expect(onUpdate).toHaveBeenCalledWith({ serviceId: "svc-tinte", employeeId: "" });
  });

  it("al elegir profesional actualiza solo el profesional", () => {
    const onUpdate = vi.fn();
    mounted = mountComponent(<AppointmentEditServiceRow {...buildProps({ onUpdate })} />);

    chooseOption(mounted.container, "Profesional", "Marta Ruiz");

    expect(onUpdate).toHaveBeenCalledWith({ employeeId: "emp-2" });
  });
});
