import type { DomainEventBus, DomainEventHandlerTable, DomainEventMap } from "./domain-events";

/**
 * Punto único de registro de manejadores de un bus. Es perezoso e idempotente:
 * el emisor lo invoca antes de publicar y el primer uso suscribe la tabla
 * completa; las llamadas siguientes no duplican suscripciones.
 */
const registeredBuses = new WeakSet<object>();

export function registerDomainEventHandlers<TMap extends DomainEventMap>(
  bus: DomainEventBus<TMap>,
  table: DomainEventHandlerTable<TMap>
): void {
  if (registeredBuses.has(bus)) return;
  registeredBuses.add(bus);

  for (const name of Object.keys(table) as Array<keyof TMap & string>) {
    bus.subscribe(name, table[name]);
  }
}
