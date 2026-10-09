import { describe, expect, it } from "vitest";
import { err, ok } from "@/infra/result";
import { parseNotificationTemplateInput } from "./template-input";

const validBody = "Hola {nombre}, te recordamos tu cita de mañana.";

describe("parseNotificationTemplateInput", () => {
  it("rechaza un evento fuera del catálogo", () => {
    const result = parseNotificationTemplateInput({ event: "otro", body_text: validBody, is_active: true });

    expect(result.ok).toBe(false);
  });

  it("recorta el cuerpo y valida la longitud mínima", () => {
    expect(
      parseNotificationTemplateInput({ event: "appointment_reminder", body_text: "   corto  ", is_active: true })
    ).toEqual(err("La plantilla debe tener al menos 10 caracteres."));
  });

  it("devuelve la plantilla validada con el cuerpo recortado", () => {
    expect(
      parseNotificationTemplateInput({
        event: "appointment_cancelled",
        body_text: `  ${validBody}  `,
        is_active: false,
      })
    ).toEqual(ok({ event: "appointment_cancelled", body_text: validBody, is_active: false }));
  });
});
