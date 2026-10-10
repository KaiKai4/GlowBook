import "server-only";
import { assertAnonymousRateLimit, type RateLimitOptions } from "@/infra/security/rate-limit";
import type { Result } from "@/infra/result";

// Variante de defineAction para las server actions sin sesion (login, recuperar
// contrasena, aceptar invitaciones). No hay contexto ni permiso: el limite es por
// IP y el pipeline es limite -> validacion -> UNA llamada a un caso de uso. Sin
// revalidacion: ninguna vista autenticada depende de estas acciones.

export interface PublicActionSpec<TRaw, TInput, TOutput> {
  /** Ambito del limite por IP. Sin opciones se aplica el limite anonimo por defecto. */
  rateLimit: { scope: string; options?: RateLimitOptions };
  /** Lee y valida la entrada. Un fallo corta antes del caso de uso. */
  parse: (raw: TRaw) => Result<TInput>;
  /** Unica llamada a un caso de uso. */
  run: (input: TInput) => Promise<Result<TOutput>>;
}

/**
 * Crea la funcion de una accion publica. El resultado es una funcion async normal:
 * la exportacion "use server" de la ruta la envuelve en una accion de una linea.
 */
export function definePublicAction<TRaw, TInput, TOutput>(
  spec: PublicActionSpec<TRaw, TInput, TOutput>
): (raw: TRaw) => Promise<Result<TOutput>> {
  return async (raw: TRaw): Promise<Result<TOutput>> => {
    const limited = await assertAnonymousRateLimit(spec.rateLimit.scope, spec.rateLimit.options);
    if (!limited.ok) return limited;

    const parsed = spec.parse(raw);
    if (!parsed.ok) return parsed;

    return spec.run(parsed.value);
  };
}
