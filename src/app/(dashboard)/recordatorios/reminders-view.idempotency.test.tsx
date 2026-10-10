// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { chooseOption } from "@/test/ui-appointments-dom";
import { clickElement, findButtonByText, requireElement } from "@/test/ui-shared-dom";
import { idempotencyKeyOf, settleSubmission, UUID_PATTERN } from "@/test/form-intent-dom";
import type { ReminderAppointment } from "@/features/reminders";
import { markReminderSentAction, confirmReminderAppointmentAction } from "./actions";
import { RemindersView } from "./reminders-view";

vi.mock("./actions", () => ({
  confirmReminderAppointmentAction: vi.fn(),
  markReminderSentAction: vi.fn(),
}));

const IN_TWO_DAYS = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

function appointment(): ReminderAppointment {
  return {
    id: "appt-1",
    status: "scheduled",
    start_time: IN_TWO_DAYS,
    total_price: 25,
    last_reminder_sent_at: null,
    last_reminder_channel: null,
    customer: { first_name: "Lucía", last_name: "Gómez", phone: "+507 6000-1234" },
    items: [{ id: "item-1", service: { name: "Corte" }, employee: { id: "emp-1", first_name: "Ana", last_name: "Vega" } }],
  };
}

describe("RemindersView con intención idempotente", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(markReminderSentAction).mockReset();
    vi.mocked(confirmReminderAppointmentAction).mockReset();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  function renderView(): MountedComponent {
    mounted = mountComponent(
      <RemindersView
        appointments={[appointment()]}
        employees={[{ id: "emp-1", name: "Ana Vega" }]}
        tz="America/Panama"
        salonName="Salón Luna"
        template="Hola {cliente}, tu cita es el {fecha}."
      />
    );
    chooseOption(mounted.container, "Vista", "Próximos 7 días");
    return mounted;
  }

  function openActions(container: HTMLElement): void {
    clickElement(requireElement<HTMLButtonElement>(container, 'button[aria-label="Abrir acciones del recordatorio"]'));
  }

  it("envía appointment_id e idempotency_key uuid al marcar el recordatorio enviado", async () => {
    vi.mocked(markReminderSentAction).mockResolvedValue({ ok: true, value: "2026-06-12T10:00:00.000Z" });
    const { container } = renderView();

    openActions(container);
    clickElement(findButtonByText(container, "Marcar recordatorio enviado"));
    await settleSubmission();

    expect(markReminderSentAction).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(markReminderSentAction).mock.calls[0]?.[0];
    expect(formData?.get("appointment_id")).toBe("appt-1");
    expect(idempotencyKeyOf(formData)).toMatch(UUID_PATTERN);
  });

  it("reutiliza la misma clave al reintentar tras un error", async () => {
    vi.mocked(markReminderSentAction)
      .mockResolvedValueOnce({ ok: false, error: "Demasiados intentos." })
      .mockResolvedValueOnce({ ok: true, value: "2026-06-12T10:00:00.000Z" });
    const { container } = renderView();

    openActions(container);
    clickElement(findButtonByText(container, "Marcar recordatorio enviado"));
    await settleSubmission();
    openActions(container);
    clickElement(findButtonByText(container, "Marcar recordatorio enviado"));
    await settleSubmission();

    const calls = vi.mocked(markReminderSentAction).mock.calls;
    expect(calls).toHaveLength(2);
    expect(idempotencyKeyOf(calls[1]?.[0])).toBe(idempotencyKeyOf(calls[0]?.[0]));
  });

  it("envía appointment_id e idempotency_key al confirmar la cita desde recordatorios", async () => {
    vi.mocked(markReminderSentAction).mockResolvedValue({ ok: true, value: "2026-06-12T10:00:00.000Z" });
    vi.mocked(confirmReminderAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const { container } = renderView();

    openActions(container);
    clickElement(findButtonByText(container, "Marcar recordatorio enviado"));
    await settleSubmission();
    clickElement(findButtonByText(container, "Confirmar cita"));
    await settleSubmission();

    const formData = vi.mocked(confirmReminderAppointmentAction).mock.calls[0]?.[0];
    expect(formData?.get("appointment_id")).toBe("appt-1");
    expect(idempotencyKeyOf(formData)).toMatch(UUID_PATTERN);
  });
});
