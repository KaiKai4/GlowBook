// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { chooseOption } from "@/test/ui-appointments-dom";
import { clickElement, findButtonByText, requireElement } from "@/test/ui-shared-dom";
import type { ReminderAppointment } from "@/features/reminders";
import { RemindersView } from "./reminders-view";

vi.mock("./actions", () => ({
  confirmReminderAppointmentAction: vi.fn(),
  markReminderSentAction: vi.fn(),
}));

// Dos días después: cae en el periodo "Próximos 7 días" sin depender de la hora actual.
const IN_TWO_DAYS = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

function appointment(overrides: Partial<ReminderAppointment> = {}): ReminderAppointment {
  return {
    id: "appt-1",
    status: "scheduled",
    start_time: IN_TWO_DAYS,
    total_price: 25,
    last_reminder_sent_at: null,
    last_reminder_channel: null,
    customer: { first_name: "Lucía", last_name: "Gómez", phone: "+507 6000-1234" },
    items: [{ id: "item-1", service: { name: "Corte" }, employee: { id: "emp-1", first_name: "Ana", last_name: "Vega" } }],
    ...overrides,
  };
}

describe("RemindersView (envío por WhatsApp)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  function renderView(appointments: ReminderAppointment[]): MountedComponent {
    return mountComponent(
      <RemindersView
        appointments={appointments}
        employees={[{ id: "emp-1", name: "Ana Vega" }]}
        tz="America/Panama"
        salonName="Salón Luna"
        template="Hola {cliente}, tu cita es el {fecha}."
      />
    );
  }

  it("abre WhatsApp con el teléfono del cliente y el mensaje, sin opener", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    mounted = renderView([appointment()]);

    // Periodo "Próximos 7 días" para que la cita de dos días aparezca en la tabla.
    chooseOption(mounted.container, "Vista", "Próximos 7 días");
    clickElement(requireElement<HTMLButtonElement>(mounted.container, 'button[aria-label="Abrir acciones del recordatorio"]'));
    clickElement(findButtonByText(mounted.container, "Enviar por WhatsApp"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0] ?? [];
    expect(url).toMatch(/^https:\/\/wa\.me\/50760001234\?text=/);
    expect(decodeURIComponent(String(url))).toContain("Hola Lucía");
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
  });

  it("no ofrece el envío por WhatsApp si el cliente no tiene teléfono", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    mounted = renderView([appointment({ customer: { first_name: "Lucía", last_name: "Gómez", phone: null } })]);

    chooseOption(mounted.container, "Vista", "Próximos 7 días");
    clickElement(requireElement<HTMLButtonElement>(mounted.container, 'button[aria-label="Abrir acciones del recordatorio"]'));
    const whatsapp = findButtonByText(mounted.container, "Enviar por WhatsApp");

    expect(whatsapp.disabled).toBe(true);
    clickElement(whatsapp);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
