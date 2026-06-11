import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type QueryResult<T> = { data: T | null; error: { message: string } | null };
export type CountResult = { count: number | null; error: { message: string } | null };
export type UntypedQuery = {
  select: (columns?: string, options?: { count?: "exact"; head?: boolean }) => UntypedQuery;
  insert: (values: unknown) => UntypedQuery;
  update: (values: unknown) => UntypedQuery;
  upsert: (values: unknown, options?: { onConflict?: string }) => UntypedQuery;
  delete: () => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  gte: (column: string, value: unknown) => UntypedQuery;
  lt: (column: string, value: unknown) => UntypedQuery;
  in: (column: string, value: unknown[]) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  maybeSingle: <T>() => Promise<QueryResult<T>>;
  single: <T>() => Promise<QueryResult<T>>;
  then: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
};
export type UntypedSupabase = {
  from: (table: string) => UntypedQuery;
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

// service_role: la configuracion comercial es cross-tenant y los conteos de uso
// deben funcionar tambien desde el panel de plataforma (sesion sin claim salon_id).
// Todo acceso pasa por use-cases server-only que ya validaron al actor.
export function billingDb(): UntypedSupabase {
  return createSupabaseAdminClient() as unknown as UntypedSupabase;
}

export async function selectRows<T>(
  supabase: UntypedSupabase,
  table: string,
  columns: string,
  orderBy: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order(orderBy, { ascending: true })
    .then((result) => result as QueryResult<T[]>);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function selectWhere<T>(
  supabase: UntypedSupabase,
  table: string,
  columns: string,
  column: string,
  value: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq(column, value)
    .then((result) => result as QueryResult<T[]>);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countRows(query: UntypedQuery): Promise<number> {
  const { count, error } = await query.then((result) => result as CountResult);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function assertOk(query: UntypedQuery): Promise<void> {
  const { error } = await query.then((result) => result as { error: { message: string } | null });
  if (error) throw new Error(error.message);
}
