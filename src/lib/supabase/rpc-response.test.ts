import { describe, expect, it } from "vitest";
import { z } from "@/lib/validation/zod";
import { parseRpcResponse } from "./rpc-response";

const ResultSchema = z.object({ appointment_id: z.string(), status: z.literal("confirmed") });

describe("parseRpcResponse", () => {
  it("devuelve el dato validado cuando la RPC responde bien", () => {
    expect(
      parseRpcResponse(
        "confirm_appointment",
        { data: { appointment_id: "a1", status: "confirmed" }, error: null },
        ResultSchema
      )
    ).toEqual({ appointment_id: "a1", status: "confirmed" });
  });

  it("relanza el error de PostgREST sin transformarlo", () => {
    const failure = { code: "P0001", message: "No se puede cambiar el estado." };

    expect(() =>
      parseRpcResponse("confirm_appointment", { data: null, error: failure }, ResultSchema)
    ).toThrow();
    try {
      parseRpcResponse("confirm_appointment", { data: null, error: failure }, ResultSchema);
    } catch (error) {
      expect(error).toBe(failure);
    }
  });

  it("rechaza un dato que no cumple el esquema (sin coaccion)", () => {
    expect(() =>
      parseRpcResponse(
        "confirm_appointment",
        { data: "a1", error: null },
        ResultSchema
      )
    ).toThrow("Respuesta inesperada de la RPC confirm_appointment.");
    expect(() =>
      parseRpcResponse(
        "confirm_appointment",
        { data: { appointment_id: "a1", status: "completed" }, error: null },
        ResultSchema
      )
    ).toThrow("Respuesta inesperada de la RPC confirm_appointment.");
  });
});
