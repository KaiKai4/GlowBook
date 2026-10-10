import { describe, expect, it } from "vitest";
import { classifyAppointmentRpcFailure } from "./rpc-failure-reason";

describe("classifyAppointmentRpcFailure", () => {
  it("clasifica el solape por SQLSTATE 23P01 o por el nombre de la constraint como slot_taken", () => {
    expect(classifyAppointmentRpcFailure({ code: "23P01", message: "conflicto" })).toBe("slot_taken");
    expect(classifyAppointmentRpcFailure({ message: "no_overlap_per_employee: x" })).toBe("slot_taken");
    expect(classifyAppointmentRpcFailure(new Error("no_overlap_per_employee"))).toBe("slot_taken");
  });

  it("clasifica el cliente no disponible por su mensaje como inactive_customer", () => {
    expect(
      classifyAppointmentRpcFailure({
        message:
          "Este cliente no esta disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.",
      })
    ).toBe("inactive_customer");
  });

  it("cualquier otro fallo, incluido un valor no reconocible, es unknown", () => {
    expect(classifyAppointmentRpcFailure({ code: "42501", message: "permiso" })).toBe("unknown");
    expect(classifyAppointmentRpcFailure("texto suelto")).toBe("unknown");
    expect(classifyAppointmentRpcFailure(null)).toBe("unknown");
    expect(classifyAppointmentRpcFailure({ code: 23505 })).toBe("unknown");
  });
});
