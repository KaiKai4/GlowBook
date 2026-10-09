import { describe, expect, it } from "vitest";
import { PLATFORM_AUDIT_ACTIONS } from "@/features/audit";
import { auditActionOptions, auditActionText, isKnownAuditAction } from "./audit-messages";

// Catalogo de acciones de la bitacora: cada accion aparece una sola vez y tiene
// su texto de presentacion propio (nunca el generico de accion desconocida).

const UNKNOWN_TEXT = "Acción no reconocida";

describe("catalogo de acciones de auditoria", () => {
  it("no tiene acciones duplicadas", () => {
    expect(new Set(PLATFORM_AUDIT_ACTIONS).size).toBe(PLATFORM_AUDIT_ACTIONS.length);
  });

  it("ofrece una opcion de filtro por accion, en el orden del catalogo", () => {
    expect(auditActionOptions().map((option) => option.value)).toEqual([...PLATFORM_AUDIT_ACTIONS]);
  });

  it("cada accion tiene un texto de presentacion propio y reconocido", () => {
    for (const action of PLATFORM_AUDIT_ACTIONS) {
      expect(isKnownAuditAction(action)).toBe(true);
      expect(auditActionText(action)).not.toBe(UNKNOWN_TEXT);
    }
  });
});
