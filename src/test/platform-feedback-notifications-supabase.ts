// Doble encadenable del cliente Supabase para los tests de repositorios de
// platform, feedback y notifications. Registra cada llamada encadenada
// (select, eq, in, order, limit, insert, update, upsert, maybeSingle) y
// resuelve con la respuesta configurada por tabla o por función RPC.
import { vi, type Mock } from "vitest";

interface QueryCall {
  method: string;
  args: unknown[];
}

interface QueryResponse {
  data?: unknown;
  error?: unknown;
}

export interface RecordingQuery extends PromiseLike<QueryResponse> {
  readonly calls: QueryCall[];
  select: (...args: unknown[]) => RecordingQuery;
  eq: (...args: unknown[]) => RecordingQuery;
  in: (...args: unknown[]) => RecordingQuery;
  order: (...args: unknown[]) => RecordingQuery;
  limit: (...args: unknown[]) => RecordingQuery;
  insert: (...args: unknown[]) => RecordingQuery;
  update: (...args: unknown[]) => RecordingQuery;
  upsert: (...args: unknown[]) => RecordingQuery;
  maybeSingle: () => Promise<QueryResponse>;
}

const EMPTY_RESPONSE: QueryResponse = { data: [], error: null };

function createRecordingQuery(response: QueryResponse): RecordingQuery {
  const calls: QueryCall[] = [];

  function chain(method: string) {
    return (...args: unknown[]): RecordingQuery => {
      calls.push({ method, args });
      return query;
    };
  }

  const query: RecordingQuery = {
    calls,
    select: chain("select"),
    eq: chain("eq"),
    in: chain("in"),
    order: chain("order"),
    limit: chain("limit"),
    insert: chain("insert"),
    update: chain("update"),
    upsert: chain("upsert"),
    maybeSingle: () => {
      calls.push({ method: "maybeSingle", args: [] });
      return Promise.resolve(response);
    },
    then: (onFulfilled, onRejected) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
  };

  return query;
}

export interface FakeSupabaseOptions {
  /** Respuesta por tabla. Las tablas no declaradas devuelven lista vacía sin error. */
  tables?: Record<string, QueryResponse>;
  /** Respuesta por función RPC. Las no declaradas devuelven null sin error. */
  rpc?: Record<string, QueryResponse>;
}

export interface FakeSupabase {
  from: Mock<(table: string) => RecordingQuery>;
  rpc: Mock<(name: string, args?: unknown) => Promise<QueryResponse>>;
  /** Consultas creadas por `from`, en orden de llamada, con su tabla. */
  queries: Array<{ table: string; query: RecordingQuery }>;
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const queries: Array<{ table: string; query: RecordingQuery }> = [];

  const from: Mock<(table: string) => RecordingQuery> = vi.fn((table: string) => {
    const query = createRecordingQuery(options.tables?.[table] ?? EMPTY_RESPONSE);
    queries.push({ table, query });
    return query;
  });

  // La firma admite los argumentos de la RPC para tipar las llamadas; el doble solo responde por nombre.
  const rpc: Mock<(name: string, args?: unknown) => Promise<QueryResponse>> = vi.fn(
    async (name: string) => options.rpc?.[name] ?? { data: null, error: null }
  );

  return { from, rpc, queries };
}

/** Devuelve la primera consulta registrada para una tabla; falla si no existe. */
export function queryFor(fake: FakeSupabase, table: string): RecordingQuery {
  const found = fake.queries.find((entry) => entry.table === table);
  if (!found) throw new Error(`No hubo consulta a la tabla ${table}`);
  return found.query;
}

/** Argumentos de cada llamada a un método encadenado concreto, en orden. */
export function argsOf(query: RecordingQuery, method: string): unknown[][] {
  return query.calls.filter((call) => call.method === method).map((call) => call.args);
}
