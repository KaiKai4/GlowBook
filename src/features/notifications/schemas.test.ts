import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_MESSAGE_TEMPLATES } from "./domain/templates";
import { NotificationTemplateSchema, templateNameForEvent } from "./schemas";

// Edicion de plantillas de WhatsApp: el cuerpo debe tener al menos 10
// caracteres tras recortar espacios, el evento pertenece a la lista cerrada y
// el nombre persistido siempre es el de la plantilla por defecto del evento.

function bodyIssue(body_text: string): string | undefined {
  const result = NotificationTemplateSchema.safeParse({
    event: "appointment_reminder",
    body_text,
    is_active: true,
  });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("NotificationTemplateSchema body", () => {
  it("rejects bodies shorter than 10 characters once trimmed", () => {
    expect(bodyIssue("   hola   ")).toBe("La plantilla debe tener al menos 10 caracteres.");
  });

  it("accepts a body of exactly 10 characters", () => {
    expect(bodyIssue("0123456789")).toBeUndefined();
  });

  it("stores the trimmed body", () => {
    const result = NotificationTemplateSchema.safeParse({
      event: "appointment_cancelled",
      body_text: "   Hola {cliente}, tu cita fue cancelada.   ",
      is_active: false,
    });

    expect(result).toEqual({
      success: true,
      data: {
        event: "appointment_cancelled",
        body_text: "Hola {cliente}, tu cita fue cancelada.",
        is_active: false,
      },
    });
  });

  it("rejects every trimmed body below 10 characters", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (length) => {
        return bodyIssue("x".repeat(length)) !== undefined;
      })
    );
  });
});

describe("NotificationTemplateSchema event and flags", () => {
  it("accepts only the two customer-facing events", () => {
    for (const event of ["appointment_reminder", "appointment_cancelled"]) {
      const result = NotificationTemplateSchema.safeParse({
        event,
        body_text: "Mensaje suficientemente largo",
        is_active: true,
      });
      expect(result.success).toBe(true);
    }

    const other = NotificationTemplateSchema.safeParse({
      event: "appointment_created",
      body_text: "Mensaje suficientemente largo",
      is_active: true,
    });
    expect(other.success).toBe(false);
  });

  it("requires is_active to be a real boolean", () => {
    const result = NotificationTemplateSchema.safeParse({
      event: "appointment_reminder",
      body_text: "Mensaje suficientemente largo",
      is_active: "si",
    });

    expect(result.success).toBe(false);
  });
});

describe("templateNameForEvent", () => {
  it("returns the catalogue name of each event's default template", () => {
    expect(templateNameForEvent("appointment_reminder")).toBe(
      DEFAULT_MESSAGE_TEMPLATES.appointment_reminder.name
    );
    expect(templateNameForEvent("appointment_cancelled")).toBe(
      DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled.name
    );
  });

  it("never returns the same name for the two events", () => {
    expect(templateNameForEvent("appointment_reminder")).not.toBe(
      templateNameForEvent("appointment_cancelled")
    );
  });
});
