// Doble encadenable de Supabase para tests de repositorios de los dominios
// "small-features". Registra cada operacion (from/rpc y sus metodos encadenados)
// para que los tests afirmen filtros como eq("salon_id", ...) sin depender de
// la forma exacta del cliente real. Cada from()/rpc() consume la siguiente
// respuesta programada para ese nombre; si no hay mas, responde vacio sin error.

interface QueryError {
  message: string;
  code?: string;
}

interface QueryResponse {
  data?: unknown;
  error?: QueryError | null;
  count?: number | null;
}

interface ResolvedQuery {
  data: unknown;
  error: QueryError | null;
  count: number | null;
}

export interface RecordedOperation {
  /** Tabla (from) o funcion RPC (rpc) sobre la que se encadenan los metodos. */
  target: string;
  method: string;
  args: unknown[];
}

type ChainFn = (...args: unknown[]) => QueryDouble;

interface QueryDouble {
  select: ChainFn;
  insert: ChainFn;
  update: ChainFn;
  upsert: ChainFn;
  delete: ChainFn;
  eq: ChainFn;
  neq: ChainFn;
  gt: ChainFn;
  gte: ChainFn;
  lt: ChainFn;
  lte: ChainFn;
  ilike: ChainFn;
  or: ChainFn;
  is: ChainFn;
  in: ChainFn;
  not: ChainFn;
  order: ChainFn;
  limit: ChainFn;
  range: ChainFn;
  single: () => Promise<ResolvedQuery>;
  maybeSingle: () => Promise<ResolvedQuery>;
  then: Promise<ResolvedQuery>["then"];
}

export interface SupabaseDouble {
  from: (table: string) => QueryDouble;
  rpc: (fn: string, args?: unknown) => QueryDouble;
  operations: RecordedOperation[];
}

/** Respuestas programadas por nombre de tabla o RPC (en orden de llamada). */
export type QueryScript = Record<string, QueryResponse | QueryResponse[]>;

const DEFAULT_RESPONSE: ResolvedQuery = { data: null, error: null, count: null };

function resolve(response: QueryResponse | undefined): ResolvedQuery {
  if (!response) return DEFAULT_RESPONSE;
  return {
    data: response.data ?? null,
    error: response.error ?? null,
    count: response.count ?? null,
  };
}

function buildQuery(
  target: string,
  response: ResolvedQuery,
  operations: RecordedOperation[]
): QueryDouble {
  const record =
    (method: string): ChainFn =>
    (...args: unknown[]) => {
      operations.push({ target, method, args });
      return query;
    };
  const settle = (method: string) => () => {
    operations.push({ target, method, args: [] });
    return Promise.resolve(response);
  };
  const promise = Promise.resolve(response);

  const query: QueryDouble = {
    select: record("select"),
    insert: record("insert"),
    update: record("update"),
    upsert: record("upsert"),
    delete: record("delete"),
    eq: record("eq"),
    neq: record("neq"),
    gt: record("gt"),
    gte: record("gte"),
    lt: record("lt"),
    lte: record("lte"),
    ilike: record("ilike"),
    or: record("or"),
    is: record("is"),
    in: record("in"),
    not: record("not"),
    order: record("order"),
    limit: record("limit"),
    range: record("range"),
    single: settle("single"),
    maybeSingle: settle("maybeSingle"),
    then: promise.then.bind(promise),
  };
  return query;
}

/**
 * Crea un cliente falso. `script` indica, por tabla o RPC, las respuestas que
 * devolveran las consultas en orden. Las operaciones quedan en `operations`.
 */
export function createSupabaseDouble(script: QueryScript = {}): SupabaseDouble {
  const operations: RecordedOperation[] = [];
  const queues = new Map<string, QueryResponse[]>();
  for (const [name, responses] of Object.entries(script)) {
    queues.set(name, Array.isArray(responses) ? [...responses] : [responses]);
  }

  const next = (name: string): ResolvedQuery => {
    const queue = queues.get(name);
    return resolve(queue?.shift());
  };

  return {
    operations,
    from: (table: string) => {
      operations.push({ target: table, method: "from", args: [table] });
      return buildQuery(table, next(table), operations);
    },
    rpc: (fn: string, args?: unknown) => {
      operations.push({ target: fn, method: "rpc", args: args === undefined ? [] : [args] });
      return buildQuery(fn, next(fn), operations);
    },
  };
}

/** Operaciones encadenadas sobre una tabla o RPC concreta (sin el from/rpc inicial). */
export function operationsOn(db: SupabaseDouble, target: string): RecordedOperation[] {
  return db.operations.filter((op) => op.target === target && op.method !== "from" && op.method !== "rpc");
}
