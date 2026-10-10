import { describe, expect, it } from "vitest";
import { PLATFORM_AUDIT_ACTIONS } from "@/features/audit";
import { auditActionOptions, auditActionText, isKnownAuditAction } from "./audit-messages";

// Catálogo de acciones de la bitacora: cada accion aparece una sola vez y tiene
// su texto de presentacion propio (nunca el generico de accion desconocida).

const UNKNOWN_TEXT = "Acción no reconocida";

describe("catálogo de acciones de auditoria", () => {
  it("no tiene acciones duplicadas", () => {
    expect(new Set(PLATFORM_AUDIT_ACTIONS).size).toBe(PLATFORM_AUDIT_ACTIONS.length);
  });

  it("ofrece una opción de filtro por acción, en el orden del catálogo", () => {
    expect(auditActionOptions().map((option) => option.value)).toEqual([...PLATFORM_AUDIT_ACTIONS]);
  });

  it("cada acción tiene un texto de presentacion propio y reconocido", () => {
    for (const action of PLATFORM_AUDIT_ACTIONS) {
      expect(isKnownAuditAction(action)).toBe(true);
      expect(auditActionText(action)).not.toBe(UNKNOWN_TEXT);
    }
  });
});
