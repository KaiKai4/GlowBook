import { describe, expect, it } from "vitest";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  TEMPLATE_PLACEHOLDERS,
  renderMessageTemplate,
  type TemplateContext,
} from "./templates";

const context: TemplateContext = {
  cliente: "María",
  fecha: "26 de mayo",
  hora: "10:00 a. m.",
  servicios: "Corte, Manicure",
  colaboradores: "Ana",
  salon: "GlowBook",
};

describe("notification templates", () => {
  it("renders every supported placeholder in reminder messages", () => {
    const message = renderMessageTemplate(
      DEFAULT_MESSAGE_TEMPLATES.appointment_reminder.body_text,
      context
    );

    expect(message).toContain("María");
    expect(message).toContain("GlowBook");
    expect(message).toContain("26 de mayo");
    expect(message).toContain("10:00 a. m.");
    expect(message).toContain("Corte, Manicure");
    expect(message).toContain("Ana");
    for (const placeholder of TEMPLATE_PLACEHOLDERS) {
      expect(message).not.toContain(placeholder);
    }
  });

  it("renders cancellation messages without leaving raw placeholders", () => {
    const message = renderMessageTemplate(
      DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled.body_text,
      context
    );

    expect(message).toContain("ha sido cancelada");
    expect(message).toContain("Contáctanos para reagendar");
    for (const placeholder of TEMPLATE_PLACEHOLDERS) {
      expect(message).not.toContain(placeholder);
    }
  });

  it("replaces missing context values with empty text instead of leaking placeholders", () => {
    const message = renderMessageTemplate("Hola {cliente}, servicio: {servicios}.", {
      ...context,
      servicios: "",
    });

    expect(message).toBe("Hola María, servicio: .");
  });
});
