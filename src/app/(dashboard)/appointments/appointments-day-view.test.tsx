// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { act } from "react";
import { formatCurrency } from "@/infra/format/money";
import { type MountedComponent } from "@/test/render-dom";
import { mountWithSalon } from "@/test/ui-salon-display";
import {
  buildCalendarAppointment,
  buildEmployees,
  PAYMENT_OPTIONS,
} from "@/test/ui-appointments-fixtures";
import { buttonWithText, click } from "@/test/ui-appointments-dom";
import { AppointmentsDayView } from "./appointments-day-view";

const toastApi = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("@/components/ui/toast", () => ({ useToast: () => toastApi }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  confirmAppointmentAction: vi.fn(),
  cancelAppointmentAction: vi.fn(),
  completeAppointmentAction: vi.fn(),
}));

const SCHEDULED = buildCalendarAppointment({ id: "appt-1" });
const CONFIRMED = buildCalendarAppointment({
  id: "appt-2",
  status: "confirmed",
  start_time: "2026-10-12T10:00:00-05:00",
  end_time: "2026-10-12T11:00:00-05:00",
  customer: { id: "cust-2", first_name: "Carlos", last_name: "Mora", phone: null, email: null, is_temporary: false },
  items: [
    {
      id: "item-2",
      start_time: "2026-10-12T10:00:00-05:00",
      end_time: "2026-10-12T11:00:00-05:00",
      price: 40,
      discount_amount: 0,
      service: { id: "svc-tinte", name: "Tinte", duration_minutes: 60, category: null },
      employee: { id: "emp-2", first_name: "Marta", last_name: "Ruiz" },
    },
  ],
});
const COMPLETED = buildCalendarAppointment({
  id: "appt-3",
  status: "completed",
  start_time: "2026-10-12T09:00:00-05:00",
  end_time: "2026-10-12T09:30:00-05:00",
  customer: { id: "cust-3", first_name: "Luis", last_name: "Soto", phone: null, email: null, is_temporary: false },
});
const CANCELLED = buildCalendarAppointment({ id: "appt-4", status: "cancelled" });
const NO_SHOW = buildCalendarAppointment({
  id: "appt-5",
  status: "no_show",
  start_time: "2026-10-12T16:00:00-05:00",
  end_time: "2026-10-12T17:00:00-05:00",
  customer: { id: "cust-5", first_name: "Elena", last_name: "Vega", phone: null, email: null, is_temporary: false },
});

function renderDayView(
  overrides: Partial<Parameters<typeof AppointmentsDayView>[0]> = {}
): MountedComponent {
  return mountWithSalon(
    <AppointmentsDayView
      appointments={[SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW]}
      canManage
      view="diaria"
      weekDates={[]}
      employees={buildEmployees()}
      businessStart={8}
      businessEnd={18}
      cancellationTemplate="Hola {cliente}"
      paymentMethodOptions={PAYMENT_OPTIONS}
      {...overrides}
    />
  );
}

/** Filas de datos del resumen (sin la fila de mensaje vacío). */
function summaryRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('table[aria-label="Resumen de citas"] tbody tr')
  ).filter((row) => !row.querySelector("td[colspan]"));
}

function fire(element: Element, type: string): void {
  act(() => {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  });
}

describe("AppointmentsDayView", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    toastApi.success.mockReset();
    toastApi.error.mockReset();
    router.refresh.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  describe("resumen de citas", () => {
    it("muestra por defecto solo las citas próximas (agendadas y confirmadas), ordenadas por hora", () => {
      mounted = renderDayView();

      const rows = summaryRows(mounted.container);
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining("Carlos Mora"),
        expect.stringContaining("Ana Pérez"),
      ]);
    });

    it("cambia a completadas y canceladas con las pestañas del resumen", () => {
      mounted = renderDayView();

      click(buttonWithText(mounted.container, "Completadas"));
      expect(summaryRows(mounted.container)).toHaveLength(1);
      expect(summaryRows(mounted.container)[0]?.textContent).toContain("Luis Soto");

      click(buttonWithText(mounted.container, "Canceladas"));
      expect(summaryRows(mounted.container)).toHaveLength(1);
      expect(mounted.container.textContent).toContain("Cancelada");
    });

    it("muestra el mensaje vacío cuando el filtro no tiene citas", () => {
      mounted = renderDayView({ appointments: [COMPLETED] });

      click(buttonWithText(mounted.container, "Canceladas"));

      expect(mounted.container.textContent).toContain("No hay citas para este filtro.");
      expect(summaryRows(mounted.container)).toHaveLength(0);
    });

    it("CONDUCTA ACTUAL (posible bug): las citas 'no_show' no aparecen en ninguna pestaña del resumen", () => {
      // Las pestañas son próximas, completadas y canceladas; una cita de 'no asistió'
      // queda fuera de todas. Se fija el comportamiento actual.
      mounted = renderDayView({ appointments: [NO_SHOW] });

      expect(mounted.container.textContent).toContain("No hay citas para este filtro.");
      click(buttonWithText(mounted.container, "Completadas"));
      expect(mounted.container.textContent).toContain("No hay citas para este filtro.");
      click(buttonWithText(mounted.container, "Canceladas"));
      expect(mounted.container.textContent).toContain("No hay citas para este filtro.");
    });

    it("muestra estado, precio total y la hora de la cita en cada fila", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });

      const row = summaryRows(mounted.container)[0];
      expect(row?.textContent).toContain("Agendada");
      expect(row?.textContent).toContain("Ana Pérez");
      expect(row?.textContent).toContain("61234567");
      expect(row?.textContent).toContain(formatCurrency(25));
    });
  });

  describe("acciones sobre cada cita", () => {
    it("ofrece completar y abrir acciones solo para citas abiertas y con permiso de gestión", () => {
      mounted = renderDayView({ appointments: [SCHEDULED, COMPLETED] });

      expect(mounted.container.querySelectorAll('button[aria-label="Abrir acciones de cita"]')).toHaveLength(1);
      expect(buttonWithText(mounted.container, "Completar")).toBeInstanceOf(HTMLButtonElement);
    });

    it("no ofrece acciones de edición ni cobro sin permiso de gestión", () => {
      mounted = renderDayView({ canManage: false, appointments: [SCHEDULED] });

      expect(mounted.container.querySelector('button[aria-label="Abrir acciones de cita"]')).toBeNull();
      expect(mounted.container.textContent).not.toContain("Completar");
    });

    it("abre y cierra el menú de acciones de la cita con su estado de accesibilidad", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });
      const toggle = mounted.container.querySelector<HTMLButtonElement>('button[aria-label="Abrir acciones de cita"]');
      expect(toggle?.getAttribute("aria-expanded")).toBe("false");

      click(toggle!);
      expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      const editLink = mounted.container.querySelector<HTMLAnchorElement>('a[href="/appointments/appt-1/edit"]');
      expect(editLink?.textContent).toContain("Editar");

      click(toggle!);
      expect(toggle?.getAttribute("aria-expanded")).toBe("false");
      expect(mounted.container.querySelector('a[href="/appointments/appt-1/edit"]')).toBeNull();
    });

    it("abre el diálogo de cancelación desde el menú de acciones", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });
      click(mounted.container.querySelector<HTMLButtonElement>('button[aria-label="Abrir acciones de cita"]')!);

      click(buttonWithText(mounted.container, "Cancelar"));

      expect(document.body.textContent).toContain("Cancelar cita");
      expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Ana Pérez");
      expect(mounted.container.querySelector('a[href="/appointments/appt-1/edit"]')).toBeNull();
    });

    it("abre el diálogo de cobro desde el botón Completar", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });

      click(buttonWithText(mounted.container, "Completar"));

      expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Completar cita");
    });
  });

  describe("agenda y vista por trabajador", () => {
    it("abre el detalle al pulsar una cita del calendario", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });

      const calendarCard = mounted.container.querySelector<HTMLButtonElement>("div.hidden button");
      click(calendarCard!);

      expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Detalles de la cita");
    });

    it("no muestra el buscador de profesionales fuera de la vista por trabajador", () => {
      mounted = renderDayView({ view: "semanal" });

      expect(mounted.container.querySelector('input[placeholder="Buscar profesional por nombre..."]')).toBeNull();
    });

    it("filtra el calendario por el profesional elegido y permite limpiar la selección", () => {
      mounted = renderDayView({ view: "trabajador", appointments: [SCHEDULED, CONFIRMED] });
      const search = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Buscar profesional por nombre..."]');
      expect(mounted.container.textContent).toContain("2 profesionales");

      act(() => {
        search!.focus();
        search!.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      });
      expect(mounted.container.textContent).toContain("Lucía Gómez");
      expect(mounted.container.textContent).toContain("Marta Ruiz");

      // Seleccionar el profesional usa onMouseDown, no onClick.
      fire(buttonWithText(mounted.container, "Marta Ruiz"), "mousedown");

      expect(search?.value).toBe("Marta Ruiz");
      expect(mounted.container.querySelector("h2")?.textContent).toBe("Marta Ruiz");
      const calendarWrapper = mounted.container.querySelector("div.hidden");
      expect(calendarWrapper?.textContent).toContain("Carlos Mora");
      expect(calendarWrapper?.textContent).not.toContain("Ana Pérez");

      click(mounted.container.querySelector<HTMLButtonElement>("button.rounded-full")!);

      expect(search?.value).toBe("");
      expect(mounted.container.querySelector("h2")?.textContent).toBe("Vista del día");
      expect(mounted.container.querySelector("div.hidden")?.textContent).toContain("Ana Pérez");
    });

    it("muestra 'Sin resultados' cuando el texto no coincide con ningún profesional", () => {
      mounted = renderDayView({ view: "trabajador" });
      const search = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Buscar profesional por nombre..."]');

      act(() => {
        search!.focus();
      });
      // Cambio de texto a través del input controlado.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      act(() => {
        setter?.call(search, "zzz");
        search!.dispatchEvent(new Event("input", { bubbles: true }));
      });

      expect(mounted.container.textContent).toContain("Sin resultados");
    });

    it("cierra la lista de profesionales al perder el foco del buscador", () => {
      vi.useFakeTimers();
      try {
        mounted = renderDayView({ view: "trabajador" });
        const search = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Buscar profesional por nombre..."]');
        act(() => {
          search!.focus();
        });
        expect(mounted.container.textContent).toContain("Marta Ruiz");

        act(() => {
          search!.blur();
        });
        expect(mounted.container.textContent).toContain("Marta Ruiz");

        act(() => {
          vi.advanceTimersByTime(200);
        });
        expect(mounted.container.textContent).not.toContain("Marta Ruiz");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("diálogos encadenados desde el detalle y la lista", () => {
    /** Diálogo abierto (los diálogos se montan en el árbol, no en un portal). */
    const openDialog = (): HTMLElement => document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    it("desde el detalle, 'Completar' cierra el detalle y abre el cobro de la misma cita", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });
      click(mounted.container.querySelector<HTMLButtonElement>("div.hidden button")!);
      expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Detalles de la cita");

      click(buttonWithText(openDialog(), "Completar"));

      const dialogs = Array.from(document.body.querySelectorAll('[role="dialog"]'));
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]?.textContent).toContain("Completar cita");
    });

    it("desde el detalle, 'Cancelar cita' cierra el detalle y abre la cancelación", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });
      click(mounted.container.querySelector<HTMLButtonElement>("div.hidden button")!);

      click(buttonWithText(openDialog(), "Cancelar cita"));

      const dialogs = Array.from(document.body.querySelectorAll('[role="dialog"]'));
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]?.textContent).toContain("Cancelar cita");
    });

    it("cierra el detalle con el botón de cerrar", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });
      click(mounted.container.querySelector<HTMLButtonElement>("div.hidden button")!);

      click(document.body.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!);

      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });

    it("cierra el diálogo de cobro sin completar la cita", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });
      click(buttonWithText(mounted.container, "Completar"));

      click(buttonWithText(openDialog(), "Cancelar"));

      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });

    it("cierra el diálogo de cancelación con 'Volver'", () => {
      mounted = renderDayView({ appointments: [SCHEDULED] });
      click(mounted.container.querySelector<HTMLButtonElement>('button[aria-label="Abrir acciones de cita"]')!);
      click(buttonWithText(mounted.container, "Cancelar"));

      click(buttonWithText(openDialog(), "Volver"));

      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });
  });
});
