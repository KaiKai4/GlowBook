import { runSideEffect } from "@/infra/effects/run-side-effect";
import type { ObservabilityContext } from "@/infra/observability";

/**
 * Bus de eventos en proceso (servidor). Cada caso de uso emite sus eventos SOLO
 * tras el commit de su escritura. Los manejadores reciben el payload y nada
 * más: no reciben el bus, así no pueden reemitir eventos.
 *
 * Un manejador que falla no rechaza la emisión: se registra con contexto y se
 * devuelve un aviso que el caso de uso expone en su Result.
 */

export type DomainEventMap = Record<string, unknown>;

type DomainEventHandler<TPayload> = (payload: TPayload) => Promise<void>;

export type DomainEventHandlerTable<TMap extends DomainEventMap> = {
  readonly [K in keyof TMap]: DomainEventHandler<TMap[K]>;
};

export interface DomainEventBus<TMap extends DomainEventMap> {
  subscribe<K extends keyof TMap & string>(name: K, handler: DomainEventHandler<TMap[K]>): void;
  publish<K extends keyof TMap & string>(
    name: K,
    payload: TMap[K],
    context: ObservabilityContext
  ): Promise<string[]>;
}

export function createDomainEventBus<TMap extends DomainEventMap>(): DomainEventBus<TMap> {
  const registry: { [K in keyof TMap]?: DomainEventHandler<TMap[K]>[] } = {};

  return {
    subscribe(name, handler) {
      const current = registry[name] ?? [];
      current.push(handler);
      registry[name] = current;
    },

    async publish(name, payload, context) {
      const warnings: string[] = [];
      for (const handler of registry[name] ?? []) {
        const outcome = await runSideEffect(name, () => handler(payload), context);
        if (!outcome.ok) warnings.push(outcome.warning);
      }
      return warnings;
    },
  };
}
