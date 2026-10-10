import type { Database, Json } from "@/types/database.types";
import { toCanonicalPayload } from "@/infra/idempotency/canonical-json";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import type { z } from "@/infra/validation/zod";

/** Nombres de las RPC de la base (funciones del esquema public). */
export type RpcName = keyof Database["public"]["Functions"];

/** Subconjunto de cliente Supabase que usa el helper (el cliente de servidor lo cumple). */
export interface RpcClient {
  rpc(
    fn: RpcName,
    args: { payload: Json }
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Llama a una RPC de escritura idempotente: serializa el payload con
 * toCanonicalPayload (misma clave lógica, mismo resultado), invoca la RPC con el
 * argumento `payload` y valida la respuesta con el esquema (parseRpcResponse).
 * Un error de PostgREST se relanza tal cual; el mapeo a mensaje público lo hace el llamador.
 */
export async function callIdempotentRpc<T>(
  client: RpcClient,
  name: RpcName,
  payload: unknown,
  schema: z.ZodType<T>
): Promise<T> {
  const response = await client.rpc(name, { payload: toCanonicalPayload(payload) });
  return parseRpcResponse(name, response, schema);
}
