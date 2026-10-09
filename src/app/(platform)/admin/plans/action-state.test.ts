import { describe, expect, it } from "vitest";
import { err, ok } from "@/infra/result";
import { toPlanActionState } from "./action-state";

describe("toPlanActionState", () => {
  it("un exito devuelve el mensaje sin avisos cuando no los hay", () => {
    expect(toPlanActionState(ok("Plan guardado."))).toEqual({ ok: true, message: "Plan guardado." });
  });

  it("un exito con avisos los conserva junto al mensaje", () => {
    expect(toPlanActionState(ok("Pago registrado.", ["La auditoria no se registro."]))).toEqual({
      ok: true,
      message: "Pago registrado.",
      warnings: ["La auditoria no se registro."],
    });
  });

  it("un error devuelve su mensaje en el estado del formulario", () => {
    expect(toPlanActionState(err("El código ya existe."))).toEqual({
      ok: false,
      message: "El código ya existe.",
    });
  });
});
