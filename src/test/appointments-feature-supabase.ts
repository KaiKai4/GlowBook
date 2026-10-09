// Doble encadenable de Supabase para tests de repositorios de appointments.
// Registra cada llamada encadenada (select, eq, gte, update...) por tabla para
// que los tests afirmen filtros como salon_id sin depender de la base de datos.
import { vi } from "vitest";
import type { createSupabaseServerClient } from "@/infra/supabase/server";

interface FakeSupabaseError {
  message: string;
}

/** Respuesta que devuelve una tabla al terminar la cadena (await, single o maybeSingle). */
export interface FakeTableResponse {
  data?: unknown;
  error?: FakeSupabaseError | null;
}

interface RecordedCall {
  method: string;
  args: unknown[];
}

interface RecordedQuery {
  table: string;
  calls: RecordedCall[];
}

interface ResolvedResponse {
  data: unknown;
  error: FakeSupabaseError | null;
}

interface AppointmentsQueryBuilder {
  select: (...args: unknown[]) => AppointmentsQueryBuilder;
  insert: (...args: unknown[]) => AppointmentsQueryBuilder;
  update: (...args: unknown[]) => AppointmentsQueryBuilder;
  eq: (...args: unknown[]) => AppointmentsQueryBuilder;
  neq: (...args: unknown[]) => AppointmentsQueryBuilder;
  gte: (...args: unknown[]) => AppointmentsQueryBuilder;
  lte: (...args: unknown[]) => AppointmentsQueryBuilder;
  in: (...args: unknown[]) => AppointmentsQueryBuilder;
  order: (...args: unknown[]) => AppointmentsQueryBuilder;
  single: () => Promise<ResolvedResponse>;
  maybeSingle: () => Promise<ResolvedResponse>;
  then: (
    onFulfilled?: ((value: ResolvedResponse) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => Promise<unknown>;
}

export interface AppointmentsSupabaseDouble {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  queries: RecordedQuery[];
  /** Llamadas registradas para una tabla, en el orden en que se abrieron. */
  callsFor: (table: string) => RecordedCall[];
}

function createQueryBuilder(
  table: string,
  response: FakeTableResponse,
  log: RecordedQuery[]
): AppointmentsQueryBuilder {
  const entry: RecordedQuery = { table, calls: [] };
  log.push(entry);
  const resolved: ResolvedResponse = {
    data: response.data ?? null,
    error: response.error ?? null,
  };

  const builder: AppointmentsQueryBuilder = {
    select: (...args) => chain("select", args),
    insert: (...args) => chain("insert", args),
    update: (...args) => chain("update", args),
    eq: (...args) => chain("eq", args),
    neq: (...args) => chain("neq", args),
    gte: (...args) => chain("gte", args),
    lte: (...args) => chain("lte", args),
    in: (...args) => chain("in", args),
    order: (...args) => chain("order", args),
    single: async () => {
      entry.calls.push({ method: "single", args: [] });
      return resolved;
    },
    maybeSingle: async () => {
      entry.calls.push({ method: "maybeSingle", args: [] });
      return resolved;
    },
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  function chain(method: string, args: unknown[]): AppointmentsQueryBuilder {
    entry.calls.push({ method, args });
    return builder;
  }

  return builder;
}

/**
 * Crea un cliente falso con `from(tabla)` y `rpc(nombre, args)`. Las tablas no
 * declaradas responden lista vacía sin error. Se usa con
 * `installSupabaseDouble` para sustituir `createSupabaseServerClient`.
 */
export function createAppointmentsSupabaseDouble(
  tables: Record<string, FakeTableResponse> = {},
  rpcResponse: FakeTableResponse = { data: null, error: null }
): AppointmentsSupabaseDouble {
  const queries: RecordedQuery[] = [];
  const from = vi.fn((table: string) =>
    createQueryBuilder(table, tables[table] ?? { data: [], error: null }, queries)
  );
  const rpc = vi.fn(async () => ({
    data: rpcResponse.data ?? null,
    error: rpcResponse.error ?? null,
  }));

  return {
    from,
    rpc,
    queries,
    callsFor: (table: string) =>
      queries.filter((query) => query.table === table).flatMap((query) => query.calls),
  };
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Hace que `createSupabaseServerClient` (mockeado por el test) devuelva el doble.
 * Doble tipado mínimo: solo implementa `from` y `rpc`, que son los únicos
 * métodos que usan los repositorios de appointments. El cast se concentra aquí.
 */
export function installSupabaseDouble(
  double: AppointmentsSupabaseDouble,
  mockedCreateClient: { mockResolvedValue: (value: ServerClient) => unknown }
): void {
  const client = { from: double.from, rpc: double.rpc } as unknown as ServerClient;
  mockedCreateClient.mockResolvedValue(client);
}
