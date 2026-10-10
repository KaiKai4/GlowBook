// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTimeTz } from "@/infra/format/dates";
import { formatCurrency } from "@/infra/format/money";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { SALON_TZ, WIZARD_EMPLOYEES, WIZARD_SERVICES } from "@/test/ui-appointments-fixtures";
import { buttonWithText, click, fieldWithLabel, setFieldValue } from "@/test/ui-appointments-dom";
import type { AppointmentScheduleItem } from "./appointment-wizard-types";
import { AppointmentSummaryStep } from "./appointment-summary-step";

const START = new Date("2026-10-12T14:00:00-05:00");
const END = new Date("2026-10-12T15:00:00-05:00");

type StepProps = Parameters<typeof AppointmentSummaryStep>[0];

const SCHEDULE: AppointmentScheduleItem[] = [
  {
    row: { key: "r0", categoryId: "cat-cabello", serviceId: "svc-corte", employeeId: "emp-1" },
    service: WIZARD_SERVICES[0],
    start: START,
    end: END,
  },
  {
    row: { key: "r1", categoryId: "cat-unas", serviceId: "svc-manicura", employeeId: "emp-2" },
    service: WIZARD_SERVICES[2],
    start: END,
    end: new Date("2026-10-12T15:45:00-05:00"),
  },
];

function buildProps(overrides: Partial<StepProps> = {}): StepProps {
  return {
    customerName: "Ana Pérez",
    schedule: SCHEDULE,
    employees: WIZARD_EMPLOYEES,
    timezone: SALON_TZ,
    total: 40,
    notes: "",
    setNotes: vi.fn(),
    submitError: null,
    submitting: false,
    onBack: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
}

describe("AppointmentSummaryStep", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function render(overrides: Partial<StepProps> = {}) {
    const props = buildProps(overrides);
    mounted = mountComponent(<AppointmentSummaryStep {...props} />);
    return { container: mounted.container, props };
  }

  it("resume el cliente, cada servicio con su horario, profesional y precio, y el total", () => {
    const { container } = render();

    const text = container.textContent ?? "";
    expect(text).toContain("Ana Pérez");
    expect(text).toContain("Corte");
    expect(text).toContain("Lucía Gómez");
    expect(text).toContain(`${formatTimeTz(START, SALON_TZ)} - ${formatTimeTz(END, SALON_TZ)}`);
    expect(text).toContain("Manicura");
    expect(text).toContain("Marta Ruiz");
    expect(text).toContain(formatCurrency(25));
    expect(text).toContain(formatCurrency(15));
    expect(text).toContain(formatCurrency(40));
  });

  it("no inventa horario para un servicio que todavía no tiene inicio calculado", () => {
    const { container } = render({
      schedule: [{ ...SCHEDULE[0]!, start: null, end: null }],
    });

    expect(container.textContent).not.toContain(formatTimeTz(START, SALON_TZ));
    expect(container.textContent).toContain("Corte");
  });

  it("no muestra profesional cuando la fila apunta a una persona que no existe", () => {
    const { container } = render({
      schedule: [{ ...SCHEDULE[0]!, row: { ...SCHEDULE[0]!.row, employeeId: "emp-desconocido" } }],
    });

    expect(container.textContent).not.toContain("Lucía Gómez");
  });

  it("reporta las notas escritas por la persona que agenda", () => {
    const { container, props } = render();

    setFieldValue(fieldWithLabel(container, "Notas (opcional)"), "Llega 10 minutos antes");

    expect(props.setNotes).toHaveBeenCalledWith("Llega 10 minutos antes");
  });

  it("muestra el error de envío devuelto por el asistente", () => {
    const { container } = render({ submitError: "El horario ya no está disponible." });

    expect(container.textContent).toContain("El horario ya no está disponible.");
  });

  it("muestra la confirmación en curso y evita reenviar mientras se guarda", () => {
    const { container, props } = render({ submitting: true });

    const confirm = buttonWithText(container, "Confirmar cita");
    expect(confirm.disabled).toBe(true);
    click(confirm);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("confirma la cita y permite volver al paso de servicios", () => {
    const { container, props } = render();

    click(buttonWithText(container, "Confirmar cita"));
    click(buttonWithText(container, "Atras"));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
