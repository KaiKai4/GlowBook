import { describe, expect, it } from "vitest";
import { buildCancellationMessage } from "./cancellation-message";

describe("buildCancellationMessage", () => {
  const template = "Hola {cliente}, tu cita del {fecha} a las {hora} con {colaboradores} ({servicios}) en {salon} fue cancelada.";

  it("rellena la plantilla con cliente, servicios, profesionales y salón", () => {
    const message = buildCancellationMessage({
      template,
      salonName: "Glow",
      tz: "America/Panama",
      appt: {
        start_time: "2026-10-12T14:00:00Z",
        customer: { first_name: "Ana", phone: "6000-1234" },
        items: [
          { service: { name: "Corte" }, employee: { first_name: "Lucía", last_name: "Gómez" } },
          { service: { name: "Tinte" }, employee: { first_name: "Lucía", last_name: "Gómez" } },
        ],
      },
    });

    expect(message).toContain("Hola Ana");
    expect(message).toContain("Corte, Tinte");
    expect(message).toContain("Lucía Gómez");
    expect(message).toContain("en Glow fue cancelada");
    expect(message).not.toContain("{");
  });

  it("usa textos de respaldo cuando faltan fecha, servicios y profesionales", () => {
    const message = buildCancellationMessage({
      template,
      salonName: "Glow",
      tz: "America/Panama",
      appt: { start_time: null, customer: null, items: [] },
    });

    expect(message).toContain("la fecha programada");
    expect(message).toContain("la hora programada");
    expect(message).toContain("nuestro equipo");
    expect(message).toContain("Servicios de belleza");
  });
});
