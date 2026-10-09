// Doble encadenable de Supabase para los repos de access y employees.
// Cada from(tabla) consume la siguiente respuesta configurada para esa tabla
// (o una respuesta vacía) y registra cada método llamado con sus argumentos,
// para que los tests afirmen filtros como salon_id sin depender de la BD.
export interface FakeDbResponse {
  data?: unknown;
  error?: unknown;
}

interface RecordedQueryCall {
  table: string;
  method: string;
  args: unknown[];
}

interface ResolvedDbResponse {
  data: unknown;
  error: unknown;
}

interface FakeQueryBuilder {
  select: (...args: unknown[]) => FakeQueryBuilder;
  insert: (...args: unknown[]) => FakeQueryBuilder;
  update: (...args: unknown[]) => FakeQueryBuilder;
  upsert: (...args: unknown[]) => FakeQueryBuilder;
  delete: (...args: unknown[]) => FakeQueryBuilder;
  eq: (...args: unknown[]) => FakeQueryBuilder;
  is: (...args: unknown[]) => FakeQueryBuilder;
  in: (...args: unknown[]) => FakeQueryBuilder;
  gte: (...args: unknown[]) => FakeQueryBuilder;
  ilike: (...args: unknown[]) => FakeQueryBuilder;
  order: (...args: unknown[]) => FakeQueryBuilder;
  limit: (...args: unknown[]) => FakeQueryBuilder;
  single: () => Promise<ResolvedDbResponse>;
  maybeSingle: () => Promise<ResolvedDbResponse>;
  then: (
    onFulfilled?: ((value: ResolvedDbResponse) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => Promise<unknown>;
}

export interface FakeSupabaseClient {
  from: (table: string) => FakeQueryBuilder;
}

export interface FakeSupabase {
  client: FakeSupabaseClient;
  calls: RecordedQueryCall[];
  /** Devuelve solo las llamadas hechas sobre una tabla concreta. */
  callsFor: (table: string) => RecordedQueryCall[];
  /** Devuelve los argumentos de la primera llamada a un método sobre una tabla. */
  argsOf: (table: string, method: string) => unknown[] | undefined;
}

export function createFakeSupabase(
  responses: Record<string, FakeDbResponse[]> = {}
): FakeSupabase {
  const calls: RecordedQueryCall[] = [];
  const queues = new Map<string, FakeDbResponse[]>(
    Object.entries(responses).map(([table, list]) => [table, [...list]])
  );

  function nextResponse(table: string): ResolvedDbResponse {
    const response = queues.get(table)?.shift();
    return { data: response?.data ?? null, error: response?.error ?? null };
  }

  function buildQuery(table: string): FakeQueryBuilder {
    const resolved = nextResponse(table);
    const chain = (method: string) =>
      (...args: unknown[]): FakeQueryBuilder => {
        calls.push({ table, method, args });
        return query;
      };
    const finish = (method: string) => async (): Promise<ResolvedDbResponse> => {
      calls.push({ table, method, args: [] });
      return resolved;
    };

    const query: FakeQueryBuilder = {
      select: chain("select"),
      insert: chain("insert"),
      update: chain("update"),
      upsert: chain("upsert"),
      delete: chain("delete"),
      eq: chain("eq"),
      is: chain("is"),
      in: chain("in"),
      gte: chain("gte"),
      ilike: chain("ilike"),
      order: chain("order"),
      limit: chain("limit"),
      single: finish("single"),
      maybeSingle: finish("maybeSingle"),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(resolved).then(onFulfilled, onRejected),
    };
    return query;
  }

  const client: FakeSupabaseClient = {
    from: (table: string) => buildQuery(table),
  };

  return {
    client,
    calls,
    callsFor: (table) => calls.filter((call) => call.table === table),
    argsOf: (table, method) =>
      calls.find((call) => call.table === table && call.method === method)?.args,
  };
}
