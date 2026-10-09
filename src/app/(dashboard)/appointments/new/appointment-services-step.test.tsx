// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { formatTimeTz } from "@/infra/format/dates";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  WIZARD_CATEGORIES,
  WIZARD_EMPLOYEES,
  WIZARD_SERVICES,
  SALON_TZ,
} from "@/test/ui-appointments-fixtures";
import {
  buttonWithText,
  chooseOption,
  click,
  nativeOptionTexts,
  selectedLabelOf,
  selectTriggerWithLabel,
  setFieldValue,
} from "@/test/ui-appointments-dom";
import type { AppointmentScheduleItem } from "./appointment-wizard-types";
import { AppointmentServicesStep } from "./appointment-services-step";

vi.mock("@/components/ui/date-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/components/ui/time-picker", () => import("@/test/ui-appointments-pickers"));

const START = new Date("2026-10-12T14:00:00-05:00");
const END = new Date("2026-10-12T15:00:00-05:00");

type StepProps = Parameters<typeof AppointmentServicesStep>[0];

function scheduleItem(overrides: Partial<AppointmentScheduleItem["row"]> = {}): AppointmentScheduleItem {
  const service = WIZARD_SERVICES[0];
  return {
    row: {
      key: "r0",
      categoryId: "cat-cabello",
      serviceId: "svc-corte",
      employeeId: "emp-1",
      ...overrides,
    },
    service,
    start: START,
    end: END,
  };
}

function buildProps(overrides: Partial<StepProps> = {}): StepProps {
  return {
    date: "2026-10-12",
    setDate: vi.fn(),
    time: "14:00",
    setTime: vi.fn(),
    selectedWindow: { open: "08:00", close: "18:00" },
    isClosedDay: false,
    loadingAvailability: false,
    schedule: [scheduleItem()],
    rowsCount: 1,
    categories: WIZARD_CATEGORIES,
    services: WIZARD_SERVICES,
    timezone: SALON_TZ,
    dragIndex: null,
    setDragIndex: vi.fn(),
    getEligibleEmployees: vi.fn(() => WIZARD_EMPLOYEES),
    updateRow: vi.fn(),
    addRow: vi.fn(),
    removeRow: vi.fn(),
    reorder: vi.fn(),
    onLoadAvailability: vi.fn(),
    onBack: vi.fn(),
    onContinue: vi.fn(),
    canContinue: true,
    ...overrides,
  };
}

describe("AppointmentServicesStep", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function render(overrides: Partial<StepProps> = {}) {
    const props = buildProps(overrides);
    mounted = mountComponent(<AppointmentServicesStep {...props} />);
    return { container: mounted.container, props };
  }

  describe("fecha y hora", () => {
    it("pide elegir una fecha antes de mostrar servicios", () => {
      const { container } = render({ date: "", schedule: [] });

      expect(container.textContent).toContain("Elige una fecha para ver disponibilidad.");
      expect(container.querySelectorAll("[draggable='true']")).toHaveLength(0);
    });

    it("avisa cuando el salón está cerrado el día elegido", () => {
      const { container } = render({ isClosedDay: true, selectedWindow: null });

      expect(container.textContent).toContain("El salon esta cerrado ese día.");
      expect(container.querySelectorAll("[draggable='true']")).toHaveLength(0);
    });

    it("al cambiar la fecha informa el nuevo valor y pide la disponibilidad de ese día", async () => {
      const { container, props } = render();

      await act(async () => {
        setFieldValue(container.querySelector<HTMLInputElement>('input[aria-label="Fecha"]')!, "2026-10-13");
      });

      expect(props.setDate).toHaveBeenCalledWith("2026-10-13");
      expect(props.onLoadAvailability).toHaveBeenCalledWith("2026-10-13");
    });

    it("limita la hora de inicio al horario de apertura y cierre del día", () => {
      const { container } = render();

      const time = container.querySelector<HTMLInputElement>('input[aria-label="Hora de inicio"]');
      expect(time?.getAttribute("data-min")).toBe("08:00");
      expect(time?.getAttribute("data-max")).toBe("18:00");
    });

    it("usa el horario por defecto cuando el día no tiene ventana de atención", () => {
      const { container } = render({ selectedWindow: null, isClosedDay: false });

      const time = container.querySelector<HTMLInputElement>('input[aria-label="Hora de inicio"]');
      expect(time?.getAttribute("data-min")).toBe("06:00");
      expect(time?.getAttribute("data-max")).toBe("21:30");
    });

    it("reporta el cambio de hora de inicio", () => {
      const { container, props } = render();

      setFieldValue(container.querySelector<HTMLInputElement>('input[aria-label="Hora de inicio"]')!, "10:30");

      expect(props.setTime).toHaveBeenCalledWith("10:30");
    });

    it("muestra que la disponibilidad se está cargando", () => {
      const { container } = render({ loadingAvailability: true });

      expect(container.textContent).toContain("Cargando disponibilidad...");
    });
  });

  describe("servicios del horario", () => {
    it("muestra cada servicio con su número, horario y valor de lista", () => {
      const { container } = render();

      const card = container.querySelector("[draggable='true']");
      expect(card?.textContent).toContain("Servicio 1");
      expect(card?.textContent).toContain(
        `${formatTimeTz(START, SALON_TZ)} - ${formatTimeTz(END, SALON_TZ)}`
      );
    });

    it("solo ofrece los servicios de la categoría elegida", () => {
      const { container } = render();

      expect(nativeOptionTexts(container, "Servicio")).toEqual([
        "Selecciona servicio...",
        "Corte (60min)",
        "Tinte (90min)",
      ]);
    });

    it("el placeholder de cada Select no es una opción elegible de la lista", () => {
      const { container } = render({
        schedule: [scheduleItem({ categoryId: "", serviceId: "", employeeId: "" })],
      });

      click(selectTriggerWithLabel(container, "Categoria"));
      const listed = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role='option']"));
      expect(listed.map((option) => option.textContent?.trim())).toEqual(["Cabello", "Uñas"]);
      expect(listed.some((option) => option.disabled)).toBe(false);
    });

    it("cambiar de categoría limpia el servicio y el profesional de ese horario", () => {
      const { container, props } = render();

      chooseOption(container, "Categoria", "Uñas");

      expect(props.updateRow).toHaveBeenCalledWith("r0", {
        categoryId: "cat-unas",
        serviceId: "",
        employeeId: "",
      });
    });

    it("bloquea la elección de servicio hasta elegir categoría", () => {
      const { container } = render({
        schedule: [scheduleItem({ categoryId: "", serviceId: "", employeeId: "" })],
      });

      expect(selectTriggerWithLabel(container, "Servicio").disabled).toBe(true);
      expect(selectedLabelOf(container, "Servicio")).toBe("Elige categoria primero");
    });

    it("pide al profesional según el servicio y el horario de la fila", () => {
      const { container, props } = render({
        schedule: [scheduleItem({ employeeId: "" })],
      });

      expect(props.getEligibleEmployees).toHaveBeenCalledWith("svc-corte", START, END);
      chooseOption(container, "Profesional", "Marta Ruiz");

      expect(props.updateRow).toHaveBeenCalledWith("r0", { employeeId: "emp-2" });
    });

    it("avisa cuando el profesional asignado ya no está disponible en ese horario", () => {
      const { container } = render({
        getEligibleEmployees: vi.fn(() => [WIZARD_EMPLOYEES[1]!]),
        schedule: [scheduleItem({ employeeId: "emp-1" })],
      });

      expect(container.textContent).toContain("Ya no disponible");
    });

    it("indica que nadie está disponible cuando no hay profesionales elegibles", () => {
      const { container } = render({
        getEligibleEmployees: vi.fn(() => []),
        schedule: [scheduleItem({ employeeId: "" })],
      });

      expect(nativeOptionTexts(container, "Profesional")).toEqual(["Nadie disponible"]);
    });

    it("permite quitar un servicio solo cuando hay más de uno", () => {
      const { container, props } = render({ rowsCount: 2 });

      click(container.querySelector<HTMLButtonElement>('button[aria-label="Quitar servicio"]')!);

      expect(props.removeRow).toHaveBeenCalledWith("r0");
    });

    it("no ofrece quitar el único servicio del horario", () => {
      const { container } = render({ rowsCount: 1 });

      expect(container.querySelector('button[aria-label="Quitar servicio"]')).toBeNull();
    });

    it("agrega una fila nueva de servicio", () => {
      const { container, props } = render();

      click(buttonWithText(container, "Agregar otro servicio"));

      expect(props.addRow).toHaveBeenCalledTimes(1);
    });

    it("reordena arrastrando una fila sobre otra", () => {
      const { container, props } = render({
        schedule: [scheduleItem(), scheduleItem({ key: "r1", serviceId: "", categoryId: "", employeeId: "" })],
        rowsCount: 2,
        dragIndex: 0,
      });
      const [first, second] = Array.from(container.querySelectorAll<HTMLElement>("[draggable='true']"));

      act(() => {
        first?.dispatchEvent(new Event("dragstart", { bubbles: true }));
      });
      expect(props.setDragIndex).toHaveBeenCalledWith(0);

      act(() => {
        second?.dispatchEvent(new Event("drop", { bubbles: true }));
      });
      expect(props.reorder).toHaveBeenCalledWith(0, 1);
      expect(props.setDragIndex).toHaveBeenLastCalledWith(null);
    });
  });

  describe("navegación", () => {
    it("habilita continuar solo cuando el horario y los profesionales están listos", () => {
      const { container, props } = render({ canContinue: true });
      click(buttonWithText(container, "Continuar"));
      expect(props.onContinue).toHaveBeenCalledTimes(1);
    });

    it("deshabilita continuar mientras el horario no es válido", () => {
      const { container, props } = render({ canContinue: false });

      expect(buttonWithText(container, "Continuar").disabled).toBe(true);
      expect(props.onContinue).not.toHaveBeenCalled();
    });

    it("'Atras' vuelve al paso de cliente", () => {
      const { container, props } = render();

      click(buttonWithText(container, "Atras"));

      expect(props.onBack).toHaveBeenCalledTimes(1);
    });
  });
});
