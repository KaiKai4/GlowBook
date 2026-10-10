// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { chooseOption } from "@/test/ui-appointments-dom";
import { clickElement, requireElement } from "@/test/ui-shared-dom";
import type { ReminderAppointment } from "@/features/reminders";
import { RemindersView } from "./reminders-view";

vi.mock("./actions", () => ({
  confirmReminderAppointmentAction: vi.fn(),
  markReminderSentAction: vi.fn(),
}));

// Dos días después: cae en "Próximos 7 días" sin depender de la hora actual.
const IN_TWO_DAYS = Date.now() + 2 * 24 * 60 * 60 * 1000;

function appointment(index: number, overrides: Partial<ReminderAppointment> = {}): ReminderAppointment {
  return {
    id: `appt-${index}`,
    status: "scheduled",
    start_time: new Date(IN_TWO_DAYS + index * 60 * 1000).toISOString(),
    total_price: 25,
    last_reminder_sent_at: null,
    last_reminder_channel: null,
    customer: { first_name: `Cliente${index}`, last_name: "Prueba", phone: "+507 6000-1234" },
    items: [{ id: `item-${index}`, service: { name: "Corte" }, employee: { id: "emp-1", first_name: "Ana", last_name: "Vega" } }],
    ...overrides,
  };
}

function dataRows(container: HTMLElement): HTMLTableRowElement[] {
  return Array.from(container.querySelectorAll<HTMLTableRowElement>("tbody tr")).filter(
    (row) => row.querySelector("td[colspan]") === null
  );
}

describe("RemindersView con tabla DataTable", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  function renderView(appointments: ReminderAppointment[]): MountedComponent {
    mounted = mountComponent(
      <RemindersView
        appointments={appointments}
        employees={[{ id: "emp-1", name: "Ana Vega" }]}
        tz="America/Panama"
        salonName="Salón Luna"
        template="Hola {cliente}, tu cita es el {fecha}."
      />
    );
    chooseOption(mounted.container, "Vista", "Próximos 7 días");
    return mounted;
  }

  it("muestra el resumen con MetricCard y una fila por cita con su estado de recordatorio", () => {
    const { container } = renderView([
      appointment(1),
      appointment(2, { last_reminder_sent_at: new Date().toISOString() }),
    ]);

    expect(container.querySelector('table[aria-label="Citas con recordatorio"]')).not.toBeNull();
    expect(dataRows(container)).toHaveLength(2);
    expect(container.textContent).toContain("Pendientes para mañana");
    expect(container.textContent).toContain("Ventana operativa");
    expect(container.textContent).toContain("Pendiente");
    expect(container.textContent).toContain("Enviado hoy");
  });

  it("indica que el estado del recordatorio se comunica con icono y texto", () => {
    const { container } = renderView([appointment(1)]);

    const badge = Array.from(container.querySelectorAll<HTMLElement>("tbody span.rounded-full")).find(
      (element) => element.textContent === "Pendiente"
    );
    expect(badge?.textContent).toBe("Pendiente");
    expect(badge?.querySelector("svg")).not.toBeNull();
  });

  it("página de 10 en 10 y vuelve a la página 1 al cambiar un filtro", () => {
    const appointments = Array.from({ length: 12 }, (_, index) => appointment(index + 1));
    const { container } = renderView(appointments);

    expect(dataRows(container)).toHaveLength(10);
    expect(container.textContent).toContain("Página 1 de 2");

    clickElement(requireElement<HTMLButtonElement>(container, 'button[aria-label="Página siguiente"]'));
    expect(dataRows(container)).toHaveLength(2);
    expect(container.textContent).toContain("Página 2 de 2");

    chooseOption(container, "Estado", "Agendada");

    expect(dataRows(container)).toHaveLength(10);
    expect(container.textContent).toContain("Página 1 de 2");
  });

  it("muestra el mensaje vacío cuando los filtros no devuelven citas", () => {
    const { container } = renderView([appointment(1)]);

    chooseOption(container, "Estado", "Confirmada");

    expect(dataRows(container)).toHaveLength(0);
    expect(container.textContent).toContain("Sin citas para estos filtros.");
    expect(container.querySelector('nav[aria-label="Paginación de la tabla"]')).toBeNull();
  });
});
