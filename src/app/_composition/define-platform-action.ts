import "server-only";
import type { Result } from "@/infra/result";
import { runActionFlow, type FlowSpec } from "./define-action";
import type { PlatformAdminProof } from "@/infra/auth/platform-admin-proof";
import { requirePlatformAdminProof } from "./request-context";

// Variante de defineAction para las server actions del panel de plataforma. La
// guarda es ser platform admin (requirePlatformAdmin redirige si no lo es), no un
// perfil de salon: por eso no hay permiso por clave ni salonId en la sesion.

export interface PlatformActionSession {
  userId: string;
  /** Prueba de platform admin que los casos de uso de billing exigen (ADR 0028). */
  proof: PlatformAdminProof;
}

/**
 * Crea la funcion de una accion de plataforma: requirePlatformAdmin -> rate
 * limit -> validacion -> UNA llamada a un caso de uso -> revalidacion.
 */
export function definePlatformAction<TRaw, TInput, TOutput>(
  spec: FlowSpec<TRaw, TInput, TOutput, PlatformActionSession>
): (raw: TRaw) => Promise<Result<TOutput>> {
  return async (raw: TRaw): Promise<Result<TOutput>> => {
    const proof = await requirePlatformAdminProof();
    return runActionFlow(spec, { userId: proof.userId, proof }, raw);
  };
}
