// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buildCalendarAppointment, SALON_TZ } from "@/test/ui-appointments-fixtures";
import { MobileAgenda } from "./mobile-agenda";

describe("MobileAgenda", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("indica que no hay citas cuando la lista está vacía", () => {
    mounted = mountComponent(<MobileAgenda appointments={[]} tz={SALON_TZ} onApptClick={vi.fn()} />);

    expect(mounted.container.textContent).toContain("Sin citas programadas.");
    expect(mounted.container.querySelectorAll("button")).toHaveLength(0);
  });

  it("omite las citas canceladas y las que aún no tienen hora de inicio", () => {
    mounted = mountComponent(
      <MobileAgenda
        appointments={[
          buildCalendarAppointment({ id: "cancelada", status: "cancelled" }),
          buildCalendarAppointment({ id: "sin-hora", start_time: null, end_time: null }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
      />
    );

    expect(mounted.container.textContent).toContain("Sin citas programadas.");
  });

  it("agrupa por día en la zona del salón y dice cuántas citas hay en cada día", () => {
    mounted = mountComponent(
      <MobileAgenda
        appointments={[
          buildCalendarAppointment({ id: "a" }),
          buildCalendarAppointment({
            id: "b",
            start_time: "2026-10-12T16:00:00-05:00",
            end_time: "2026-10-12T17:00:00-05:00",
          }),
          // 00:30 UTC del 13 es la noche del 12 en Panamá: debe quedar en el grupo del 12.
          buildCalendarAppointment({
            id: "c",
            start_time: "2026-10-13T00:30:00Z",
            end_time: "2026-10-13T01:30:00Z",
          }),
          buildCalendarAppointment({
            id: "d",
            start_time: "2026-10-14T09:00:00-05:00",
            end_time: "2026-10-14T10:00:00-05:00",
          }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
      />
    );

    const headers = Array.from(mounted.container.querySelectorAll("p.uppercase")).map(
      (paragraph) => paragraph.textContent ?? ""
    );
    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain("3 citas");
    expect(headers[1]).toContain("1 cita");
    expect(headers[1]).not.toContain("citas");
  });

  it("ordena cronológicamente las citas dentro de cada día", () => {
    mounted = mountComponent(
      <MobileAgenda
        appointments={[
          buildCalendarAppointment({
            id: "tarde",
            customer: { id: "c2", first_name: "Tarde", last_name: "Cliente", phone: null, email: null, is_temporary: false },
            start_time: "2026-10-12T16:00:00-05:00",
            end_time: "2026-10-12T17:00:00-05:00",
          }),
          buildCalendarAppointment({
            id: "manana",
            customer: { id: "c3", first_name: "Mañana", last_name: "Cliente", phone: null, email: null, is_temporary: false },
            start_time: "2026-10-12T09:00:00-05:00",
            end_time: "2026-10-12T10:00:00-05:00",
          }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
      />
    );

    const names = Array.from(mounted.container.querySelectorAll("button p.truncate.text-sm")).map((paragraph) =>
      paragraph.textContent?.trim()
    );
    expect(names).toEqual(["Mañana Cliente", "Tarde Cliente"]);
  });

  it("muestra hora de inicio y fin, precio y los servicios separados por comas", () => {
    const appt = buildCalendarAppointment({
      total_price: 65,
      items: [
        {
          id: "i1",
          start_time: "2026-10-12T14:00:00-05:00",
          end_time: "2026-10-12T15:00:00-05:00",
          price: 25,
          discount_amount: 0,
          service: { id: "s1", name: "Corte", duration_minutes: 60, category: null },
          employee: null,
        },
        {
          id: "i2",
          start_time: "2026-10-12T15:00:00-05:00",
          end_time: "2026-10-12T16:30:00-05:00",
          price: 40,
          discount_amount: 0,
          service: { id: "s2", name: "Tinte", duration_minutes: 90, category: null },
          employee: null,
        },
        {
          id: "i3",
          start_time: "2026-10-12T16:30:00-05:00",
          end_time: "2026-10-12T17:00:00-05:00",
          price: 0,
          discount_amount: 0,
          service: null,
          employee: null,
        },
      ],
    });
    mounted = mountComponent(<MobileAgenda appointments={[appt]} tz={SALON_TZ} onApptClick={vi.fn()} />);

    const text = mounted.container.querySelector("button")?.textContent ?? "";
    expect(text).toContain(formatTimeTz(new Date("2026-10-12T14:00:00-05:00"), SALON_TZ));
    expect(text).toContain(formatTimeTz(new Date("2026-10-12T15:00:00-05:00"), SALON_TZ));
    expect(text).toContain("Corte, Tinte");
    expect(text).toContain(formatCurrency(65));
  });

  it("usa el estado de la cita como descripción cuando no hay servicios con nombre", () => {
    mounted = mountComponent(
      <MobileAgenda appointments={[buildCalendarAppointment({ status: "confirmed", items: [] })]} tz={SALON_TZ} onApptClick={vi.fn()} />
    );

    expect(mounted.container.querySelector("button")?.textContent).toContain("Confirmada");
  });

  it("entrega la cita tocada al manejador para abrir su detalle", () => {
    const onApptClick = vi.fn();
    const appt = buildCalendarAppointment({ id: "appt-tocada" });
    mounted = mountComponent(<MobileAgenda appointments={[appt]} tz={SALON_TZ} onApptClick={onApptClick} />);

    mounted.container.querySelector<HTMLButtonElement>("button")?.click();

    expect(onApptClick).toHaveBeenCalledTimes(1);
    expect(onApptClick).toHaveBeenCalledWith(appt);
  });
});
