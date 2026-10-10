import { describe, expect, it, vi } from "vitest";
import { z } from "@/infra/validation/zod";
import { callIdempotentRpc, type RpcClient } from "./call-idempotent-rpc";

const ResultSchema = z.object({ appointment_id: z.string(), status: z.literal("confirmed") });

function clientReturning(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn<RpcClient["rpc"]>(() => Promise.resolve(response));
  return { client: { rpc }, rpc };
}

describe("callIdempotentRpc", () => {
  it("envía el payload canónico (claves ordenadas, sin undefined) bajo el argumento payload", async () => {
    const { client, rpc } = clientReturning({
      data: { appointment_id: "a1", status: "confirmed" },
      error: null,
    });

    await callIdempotentRpc(
      client,
      "confirm_appointment",
      { status: "x", appointment_id: "a1", idempotency_key: undefined },
      ResultSchema
    );

    expect(rpc).toHaveBeenCalledWith("confirm_appointment", {
      payload: { appointment_id: "a1", status: "x" },
    });
    expect(JSON.stringify(rpc.mock.calls[0]?.[1])).toBe(
      '{"payload":{"appointment_id":"a1","status":"x"}}'
    );
  });

  it("devuelve el dato validado por el esquema", async () => {
    const { client } = clientReturning({
      data: { appointment_id: "a1", status: "confirmed" },
      error: null,
    });

    await expect(
      callIdempotentRpc(client, "confirm_appointment", { appointment_id: "a1" }, ResultSchema)
    ).resolves.toEqual({ appointment_id: "a1", status: "confirmed" });
  });

  it("relanza el error de la RPC sin transformarlo", async () => {
    const failure = { code: "22023", message: "Clave reutilizada con otros datos." };
    const { client } = clientReturning({ data: null, error: failure });

    await expect(
      callIdempotentRpc(client, "confirm_appointment", { appointment_id: "a1" }, ResultSchema)
    ).rejects.toBe(failure);
  });

  it("lanza un error interno si la respuesta no cumple el esquema", async () => {
    const { client } = clientReturning({ data: "a1", error: null });

    await expect(
      callIdempotentRpc(client, "confirm_appointment", { appointment_id: "a1" }, ResultSchema)
    ).rejects.toThrow("Respuesta inesperada de la RPC confirm_appointment.");
  });

  it("rechaza un payload no serializable antes de llamar a la RPC", async () => {
    const { client, rpc } = clientReturning({ data: null, error: null });

    await expect(
      callIdempotentRpc(client, "confirm_appointment", { at: new Date() }, ResultSchema)
    ).rejects.toThrow("Objeto no plano");
    expect(rpc).not.toHaveBeenCalled();
  });
});
