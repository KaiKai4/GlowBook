import { captureError, type ObservabilityContext } from "@/lib/observability";

export type SideEffectOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; warning: string };

/**
 * Ejecuta un efecto secundario posterior al commit (notificaciones, promociones
 * auxiliares, sincronizaciones). Nunca rechaza: si falla, registra el error con
 * contexto y devuelve un aviso que el caso de uso puede exponer en su Result.
 */
export async function runSideEffect<T>(
  name: string,
  fn: () => Promise<T>,
  context: ObservabilityContext
): Promise<SideEffectOutcome<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    captureError(error, {
      module: context.module,
      action: context.action,
      metadata: { ...context.metadata, effect: name },
    });
    return { ok: false, warning: `No se completó el paso «${name}».` };
  }
}
