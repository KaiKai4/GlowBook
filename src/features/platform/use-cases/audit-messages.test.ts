import { describe, expect, it } from "vitest";
import { auditActionOptions, auditActionText, isKnownAuditAction } from "./audit-messages";

const GENERIC_TEXT = "Acción no reconocida";

describe("tabla de textos de auditoria", () => {
  it("cada acción conocida tiene un texto no vacio y la misma etiqueta en el filtro", () => {
    const options = auditActionOptions();

    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.label.trim(), option.value).not.toBe("");
      expect(auditActionText(option.value)).toBe(option.label);
    }
  });

  it("una acción desconocida recibe el texto generico, nunca la clave cruda", () => {
    expect(auditActionText("legacy_action")).toBe(GENERIC_TEXT);
    expect(auditActionText("")).toBe(GENERIC_TEXT);
  });

  it("las claves heredadas del prototipo no cuentan como acciones", () => {
    expect(isKnownAuditAction("toString")).toBe(false);
    expect(isKnownAuditAction("__proto__")).toBe(false);
    expect(auditActionText("constructor")).toBe(GENERIC_TEXT);
  });

  it("las opciones del filtro cubren el catálogo con su texto", () => {
    const options = auditActionOptions();

    expect(options.find((option) => option.value === "invitation_accepted")?.label).toBe("Invitación aceptada");
    expect(options.find((option) => option.value === "set_salon_status")?.label).toBe(
      "Actualizar estado de Salón"
    );
  });
});
