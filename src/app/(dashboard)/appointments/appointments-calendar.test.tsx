// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buildCalendarAppointment, SALON_TZ } from "@/test/ui-appointments-fixtures";
import { AppointmentsCalendar } from "./appointments-calendar";

const WEEK_DATES = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];

/** Tarjetas clicables de citas (los botones del calendario). */
function cards(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
}

/** Etiquetas horarias de la columna izquierda como "8 am", "1 pm"... */
function hourLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("span.tabular-nums"))
    .map((numberNode) => {
      const period = numberNode.nextElementSibling?.textContent ?? "";
      return `${numberNode.textContent} ${period}`;
    });
}

describe("AppointmentsCalendar (vista diaria)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el título recibido y el conteo de citas activas (sin canceladas)", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[
          buildCalendarAppointment({ id: "a" }),
          buildCalendarAppointment({ id: "b", status: "cancelled" }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
        title="Lucía Gómez"
      />
    );

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Lucía Gómez");
    expect(mounted.container.textContent).toContain("1 citas activas");
  });

  it("usa 'Vista del día' como título por defecto", () => {
    mounted = mountComponent(
      <AppointmentsCalendar appointments={[]} tz={SALON_TZ} onApptClick={vi.fn()} />
    );

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Vista del día");
    expect(mounted.container.textContent).toContain("Sin citas programadas");
  });

  it("dibuja una tarjeta por cita activa con nombre completo del cliente y no dibuja las canceladas", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[
          buildCalendarAppointment({ id: "a" }),
          buildCalendarAppointment({ id: "cancelada", status: "cancelled" }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
      />
    );

    expect(cards(mounted.container)).toHaveLength(1);
    expect(cards(mounted.container)[0]?.textContent).toContain("Ana Pérez");
  });

  it("posiciona la tarjeta según la hora de inicio y la duración desde la apertura del salón", () => {
    // 14:00 con apertura 08:00 => 360 min × 1.2 px + 14 px de margen superior = 446 px; 60 min => 72 px.
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[buildCalendarAppointment({ id: "a" })]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
        businessStart={8}
        businessEnd={18}
      />
    );

    const card = cards(mounted.container)[0];
    expect(card?.style.top).toBe("446px");
    expect(card?.style.height).toBe("72px");
  });

  it("amplía la grilla para mostrar una cita anterior a la apertura del salón", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[
          buildCalendarAppointment({
            id: "temprana",
            start_time: "2026-10-12T07:00:00-05:00",
            end_time: "2026-10-12T08:00:00-05:00",
          }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
        businessStart={8}
        businessEnd={18}
      />
    );

    const labels = hourLabels(mounted.container);
    expect(labels[0]).toBe("7 am");
    expect(labels).toContain("12 pm");
    expect(labels.at(-1)).toBe("6 pm");
  });

  it("etiqueta las horas en formato de 12 horas con am/pm", () => {
    mounted = mountComponent(
      <AppointmentsCalendar appointments={[]} tz={SALON_TZ} onApptClick={vi.fn()} businessStart={8} businessEnd={13} />
    );

    expect(hourLabels(mounted.container)).toEqual(["8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm"]);
  });

  it("reparte en columnas las citas que se solapan para que no se tapen", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[
          buildCalendarAppointment({ id: "a" }),
          buildCalendarAppointment({
            id: "b",
            start_time: "2026-10-12T14:30:00-05:00",
            end_time: "2026-10-12T15:30:00-05:00",
          }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
      />
    );

    const [first, second] = cards(mounted.container);
    expect(first?.style.left).toBe("calc(0% + 2px)");
    expect(second?.style.left).toBe("calc(50% + 2px)");
    expect(first?.style.width).toBe("calc(50% - 4px)");
  });

  it("entrega la cita pulsada al manejador", () => {
    const onApptClick = vi.fn();
    const appt = buildCalendarAppointment({ id: "pulsada" });
    mounted = mountComponent(
      <AppointmentsCalendar appointments={[appt]} tz={SALON_TZ} onApptClick={onApptClick} />
    );

    cards(mounted.container)[0]?.click();

    expect(onApptClick).toHaveBeenCalledWith(appt);
  });

  it("indica que la grilla está vacía cuando no hay citas visibles", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[buildCalendarAppointment({ status: "cancelled" })]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
      />
    );

    expect(cards(mounted.container)).toHaveLength(0);
    expect(mounted.container.textContent).toContain("Sin citas programadas");
  });
});

describe("AppointmentsCalendar (vista semanal)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra una columna por día con el conteo de citas de cada día y del total semanal", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[
          buildCalendarAppointment({ id: "a" }),
          buildCalendarAppointment({
            id: "b",
            start_time: "2026-10-12T16:00:00-05:00",
            end_time: "2026-10-12T17:00:00-05:00",
          }),
          buildCalendarAppointment({
            id: "c",
            start_time: "2026-10-15T10:00:00-05:00",
            end_time: "2026-10-15T11:00:00-05:00",
          }),
          buildCalendarAppointment({ id: "d", status: "cancelled" }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
        mode="semanal"
        weekDates={WEEK_DATES}
      />
    );

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Vista semanal");
    expect(mounted.container.textContent).toContain("3 citas esta semana");
    expect(mounted.container.textContent).toContain("2 citas");
    expect(mounted.container.textContent).toContain("1 cita");
    expect(cards(mounted.container)).toHaveLength(3);
  });

  it("indica que no hay días de atención abiertos cuando la semana no tiene días visibles", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[buildCalendarAppointment()]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
        mode="semanal"
        weekDates={[]}
      />
    );

    expect(mounted.container.textContent).toContain("No hay días de atención abiertos esta semana.");
    expect(mounted.container.textContent).toContain("Sin días abiertos");
  });

  it("usa la inicial del apellido en las tarjetas compactas y entrega la cita pulsada", () => {
    const onApptClick = vi.fn();
    const appt = buildCalendarAppointment({ id: "semana" });
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[appt]}
        tz={SALON_TZ}
        onApptClick={onApptClick}
        mode="semanal"
        weekDates={WEEK_DATES}
      />
    );

    const card = cards(mounted.container)[0];
    expect(card?.textContent).toContain("Ana P.");
    card?.click();
    expect(onApptClick).toHaveBeenCalledWith(appt);
  });

  it("agrupa las citas por la fecha local del salón, no por la fecha UTC", () => {
    mounted = mountComponent(
      <AppointmentsCalendar
        appointments={[
          // 00:30 UTC del día 13 corresponde a la noche del 12 en Panamá.
          buildCalendarAppointment({
            id: "nocturna",
            start_time: "2026-10-13T00:30:00Z",
            end_time: "2026-10-13T01:30:00Z",
          }),
        ]}
        tz={SALON_TZ}
        onApptClick={vi.fn()}
        mode="semanal"
        weekDates={WEEK_DATES}
      />
    );

    const counts = Array.from(mounted.container.querySelectorAll("p.text-brand-500")).map((p) => p.textContent);
    expect(counts).toEqual(["1 cita"]);
  });
});
