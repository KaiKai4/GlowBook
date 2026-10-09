import { describe, expect, it } from "vitest";
import type { ReminderAppointment } from "@/features/reminders/view-models";
import {
  buildReminderMessage,
  buildWhatsAppUrl,
  collaboratorNames,
  customerName,
  isSameLocalDay,
  localDateStr,
} from "./reminder-format";

const TZ = "America/Panama";

function appointment(overrides: Partial<ReminderAppointment> = {}): ReminderAppointment {
  return {
    id: "appt-1",
    status: "scheduled",
    start_time: "2026-06-12T15:00:00.000Z",
    total_price: 25,
    last_reminder_sent_at: null,
    last_reminder_channel: null,
    customer: { first_name: "Lucía", last_name: "Gómez", phone: "+507 6000-1234" },
    items: [
      { id: "item-1", service: { name: "Corte" }, employee: { id: "emp-1", first_name: "Ana", last_name: "Vega" } },
    ],
    ...overrides,
  };
}

describe("localDateStr e isSameLocalDay", () => {
  it("expresa la fecha en la zona horaria del salón", () => {
    // 02:00 UTC del 13 de junio es el 12 de junio en Panamá (UTC-5, sin horario de verano).
    expect(localDateStr("2026-06-13T02:00:00.000Z", TZ)).toBe("2026-06-12");
  });

  it("compara días locales y considera que una fecha ausente nunca coincide", () => {
    expect(isSameLocalDay("2026-06-13T02:00:00.000Z", "2026-06-12", TZ)).toBe(true);
    expect(isSameLocalDay("2026-06-13T02:00:00.000Z", "2026-06-13", TZ)).toBe(false);
    expect(isSameLocalDay(null, "2026-06-12", TZ)).toBe(false);
  });
});

describe("buildWhatsAppUrl", () => {
  it("deja solo dígitos del teléfono y codifica el mensaje", () => {
    expect(buildWhatsAppUrl("+507 6000-1234", "Hola & adiós")).toBe(
      "https://wa.me/50760001234?text=Hola%20%26%20adi%C3%B3s"
    );
  });
});

describe("customerName y collaboratorNames", () => {
  it("usa el nombre completo del cliente o un texto de respaldo", () => {
    expect(customerName(appointment())).toBe("Lucía Gómez");
    expect(customerName(appointment({ customer: null }))).toBe("Sin cliente");
  });

  it("une los colaboradores sin repetir y devuelve cadena vacía sin profesional", () => {
    const appt = appointment({
      items: [
        { id: "a", service: null, employee: { id: "emp-1", first_name: "Ana", last_name: "Vega" } },
        { id: "b", service: null, employee: { id: "emp-1", first_name: "Ana", last_name: "Vega" } },
        { id: "c", service: null, employee: { id: "emp-2", first_name: "Iris", last_name: "Mora" } },
      ],
    });
    expect(collaboratorNames(appt)).toBe("Ana Vega, Iris Mora");
    expect(collaboratorNames(appointment({ items: [] }))).toBe("");
  });
});

describe("buildReminderMessage", () => {
  it("sustituye los marcadores con los datos de la cita", () => {
    const message = buildReminderMessage({
      appt: appointment(),
      tz: TZ,
      salonName: "Salón Luna",
      template: "Hola {cliente}, {servicios} con {colaboradores} en {salon}.",
    });
    expect(message).toBe("Hola Lucía, Corte con Ana Vega en Salón Luna.");
  });

  it("usa los textos de respaldo cuando faltan cliente, servicios y colaboradores", () => {
    const message = buildReminderMessage({
      appt: appointment({ customer: null, items: [] }),
      tz: TZ,
      salonName: "Salón Luna",
      template: "{cliente} | {servicios} | {colaboradores}",
    });
    expect(message).toBe("cliente | Servicios de belleza | nuestro equipo");
  });
});
