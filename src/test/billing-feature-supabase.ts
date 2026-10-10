// Doble encadenable del cliente Supabase para los tests de repositorios de billing.
// Reproduce el subconjunto de PostgREST que usan los repos (from, select, eq, in,
// order, limit, insert, update, upsert, delete, maybeSingle, single y rpc) y
// registra cada llamada para que el test afirme filtros, columnas y tabla pedida.
// No es un tipo de Supabase: el repo lo recibe a través del mock de la factoría admin.
import { PostgrestError } from "@supabase/supabase-js";
import { vi, type Mock } from "vitest";

interface BillingQueryError {
  message: string;
}

/** Resultado que devuelve una consulta terminal (await, maybeSingle o single). */
interface BillingQueryResult {
  data?: unknown;
  error?: BillingQueryError | null;
  count?: number | null;
}

/** Convierte el error simulado en un PostgrestError real, como el que lanza el cliente. */
function toPostgrestError(error: BillingQueryError | null | undefined): PostgrestError | null {
  if (!error) return null;
  return new PostgrestError({ message: error.message, details: "", hint: "", code: "" });
}

interface BillingNormalizedResult {
  data: unknown;
  error: PostgrestError | null;
  count: number | null;
}

interface BillingRecordedCall {
  method: string;
  args: unknown[];
}

export interface BillingRecordedQuery {
  table: string;
  calls: BillingRecordedCall[];
}

/** Constructor encadenable: cada método registra la llamada y devuelve el mismo constructor. */
interface BillingQueryBuilder extends PromiseLike<BillingNormalizedResult> {
  select: (...args: unknown[]) => BillingQueryBuilder;
  insert: (...args: unknown[]) => BillingQueryBuilder;
  update: (...args: unknown[]) => BillingQueryBuilder;
  upsert: (...args: unknown[]) => BillingQueryBuilder;
  delete: (...args: unknown[]) => BillingQueryBuilder;
  eq: (...args: unknown[]) => BillingQueryBuilder;
  in: (...args: unknown[]) => BillingQueryBuilder;
  order: (...args: unknown[]) => BillingQueryBuilder;
  limit: (...args: unknown[]) => BillingQueryBuilder;
  maybeSingle: () => Promise<BillingNormalizedResult>;
  single: () => Promise<BillingNormalizedResult>;
}

type TableResponse = BillingQueryResult | ((query: BillingRecordedQuery) => BillingQueryResult);

export interface BillingSupabaseFake {
  from: Mock<(table: string) => BillingQueryBuilder>;
  rpc: Mock<(fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: PostgrestError | null }>>;
  /** Todas las consultas creadas (y las RPC), en orden. */
  queries: BillingRecordedQuery[];
}

export interface BillingSupabaseFakeOptions {
  /** Respuesta por tabla. Las tablas no declaradas responden lista vacía sin error. */
  tables?: Record<string, TableResponse>;
  /** Respuesta de la RPC. Por defecto, objeto vacío sin error. */
  rpc?: BillingQueryResult;
}

export function createBillingSupabaseFake(options: BillingSupabaseFakeOptions = {}): BillingSupabaseFake {
  const queries: BillingRecordedQuery[] = [];
  const tables = options.tables ?? {};
  const rpcResult = options.rpc ?? { data: {}, error: null };

  const resolve = (query: BillingRecordedQuery): BillingNormalizedResult => {
    const response = tables[query.table];
    const raw: BillingQueryResult =
      response === undefined
        ? { data: [], error: null }
        : typeof response === "function"
          ? response(query)
          : response;
    return {
      data: raw.data ?? null,
      error: toPostgrestError(raw.error),
      count: raw.count ?? null,
    };
  };

  const createBuilder = (query: BillingRecordedQuery): BillingQueryBuilder => {
    const record = (method: string, args: unknown[]): BillingQueryBuilder => {
      query.calls.push({ method, args });
      return builder;
    };
    const terminal = (method: string, single: boolean): Promise<BillingNormalizedResult> => {
      query.calls.push({ method, args: [] });
      const result = resolve(query);
      // maybeSingle/single devuelven una fila (u null), no una lista.
      if (!single) return Promise.resolve(result);
      const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
      return Promise.resolve({ ...result, data });
    };

    const builder: BillingQueryBuilder = {
      select: (...args) => record("select", args),
      insert: (...args) => record("insert", args),
      update: (...args) => record("update", args),
      upsert: (...args) => record("upsert", args),
      delete: (...args) => record("delete", args),
      eq: (...args) => record("eq", args),
      in: (...args) => record("in", args),
      order: (...args) => record("order", args),
      limit: (...args) => record("limit", args),
      maybeSingle: () => terminal("maybeSingle", true),
      single: () => terminal("single", true),
      then: (onFulfilled, onRejected) => Promise.resolve(resolve(query)).then(onFulfilled, onRejected),
    };

    return builder;
  };

  const from = vi.fn((table: string): BillingQueryBuilder => {
    const query: BillingRecordedQuery = { table, calls: [] };
    queries.push(query);
    return createBuilder(query);
  });

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    queries.push({ table: `rpc:${fn}`, calls: [{ method: "rpc", args: [args] }] });
    return { data: rpcResult.data ?? null, error: toPostgrestError(rpcResult.error) };
  });

  return { from, rpc, queries };
}

/** Devuelve las consultas registradas sobre una tabla concreta. */
export function queriesOn(fake: BillingSupabaseFake, table: string): BillingRecordedQuery[] {
  return fake.queries.filter((query) => query.table === table);
}

/** Primera consulta registrada sobre una tabla; falla si la consulta no existió. */
export function firstQueryOn(fake: BillingSupabaseFake, table: string): BillingRecordedQuery {
  const [query] = queriesOn(fake, table);
  if (!query) throw new Error(`No hubo consultas sobre ${table}`);
  return query;
}

/** Argumentos de la primera llamada a un método dentro de una consulta. */
export function argsOf(query: BillingRecordedQuery, method: string): unknown[] | undefined {
  return query.calls.find((call) => call.method === method)?.args;
}
