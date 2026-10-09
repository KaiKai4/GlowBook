// Doble encadenable del cliente Supabase para los tests de repositorios de billing.
// Implementa el contrato UntypedSupabase de billing-db y registra cada llamada
// (from, select, eq, in, order, limit, insert, update, upsert, delete, rpc...)
// para que el test afirme filtros, columnas y tabla pedida.
import { vi, type Mock } from "vitest";
import type { UntypedQuery, UntypedSupabase } from "@/features/billing/data/billing-db";

interface BillingQueryError {
  message: string;
}

/** Resultado que devuelve una consulta terminal (await, maybeSingle o single). */
interface BillingQueryResult {
  data?: unknown;
  error?: BillingQueryError | null;
  count?: number | null;
}

interface BillingRecordedCall {
  method: string;
  args: unknown[];
}

export interface BillingRecordedQuery {
  table: string;
  calls: BillingRecordedCall[];
}

type TableResponse =
  | BillingQueryResult
  | ((query: BillingRecordedQuery) => BillingQueryResult);

export interface BillingSupabaseFake extends UntypedSupabase {
  from: Mock<(table: string) => UntypedQuery>;
  rpc: Mock<UntypedSupabase["rpc"]>;
  /** Todas las consultas creadas (y las RPC), en orden. */
  queries: BillingRecordedQuery[];
}

export interface BillingSupabaseFakeOptions {
  /** Respuesta por tabla. Las tablas no declaradas responden lista vacía sin error. */
  tables?: Record<string, TableResponse>;
  /** Respuesta de la RPC. Por defecto, objeto vacío sin error. */
  rpc?: BillingQueryResult;
}

interface NormalizedResult {
  data: unknown;
  error: BillingQueryError | null;
  count: number | null;
}

export function createBillingSupabaseFake(
  options: BillingSupabaseFakeOptions = {}
): BillingSupabaseFake {
  const queries: BillingRecordedQuery[] = [];
  const tables = options.tables ?? {};
  const rpcResult = options.rpc ?? { data: {}, error: null };

  const resolve = (query: BillingRecordedQuery): NormalizedResult => {
    const response = tables[query.table];
    const raw: BillingQueryResult =
      response === undefined
        ? { data: [], error: null }
        : typeof response === "function"
          ? response(query)
          : response;
    return {
      data: raw.data ?? null,
      error: raw.error ?? null,
      count: raw.count ?? null,
    };
  };

  const createBuilder = (query: BillingRecordedQuery): UntypedQuery => {
    const record = (method: string, args: unknown[]): UntypedQuery => {
      query.calls.push({ method, args });
      return builder;
    };

    const builder: UntypedQuery = {
      select: (...args) => record("select", args),
      insert: (...args) => record("insert", args),
      update: (...args) => record("update", args),
      upsert: (...args) => record("upsert", args),
      delete: (...args) => record("delete", args),
      eq: (...args) => record("eq", args),
      gte: (...args) => record("gte", args),
      lt: (...args) => record("lt", args),
      in: (...args) => record("in", args),
      order: (...args) => record("order", args),
      limit: (...args) => record("limit", args),
      maybeSingle: <T>() => {
        query.calls.push({ method: "maybeSingle", args: [] });
        return Promise.resolve(resolve(query) as { data: T | null; error: BillingQueryError | null });
      },
      single: <T>() => {
        query.calls.push({ method: "single", args: [] });
        return Promise.resolve(resolve(query) as { data: T | null; error: BillingQueryError | null });
      },
      then: <TResult1 = unknown, TResult2 = never>(
        onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise.resolve(resolve(query)).then(onFulfilled, onRejected),
    };

    return builder;
  };

  const from = vi.fn((table: string): UntypedQuery => {
    const query: BillingRecordedQuery = { table, calls: [] };
    queries.push(query);
    return createBuilder(query);
  });

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    queries.push({ table: `rpc:${fn}`, calls: [{ method: "rpc", args: [args] }] });
    return { data: rpcResult.data ?? null, error: rpcResult.error ?? null };
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
