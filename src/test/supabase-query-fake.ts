// Cliente de Supabase falso para tests de repositorios que encadenan
// from().select().eq().order() y terminan en await o maybeSingle().
import { vi } from "vitest";

export interface FakeQueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface FakeQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled?: ((value: FakeQueryResult) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => Promise<unknown>;
}

function queryBuilder(result: FakeQueryResult): FakeQueryBuilder {
  const builder: FakeQueryBuilder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

/**
 * Cliente con `from(tabla)` que responde según la tabla pedida. Las tablas
 * no declaradas devuelven una lista vacía sin error.
 */
export function fakeSupabaseFrom(results: Record<string, FakeQueryResult>) {
  return {
    from: vi.fn((table: string) => queryBuilder(results[table] ?? { data: [], error: null })),
  };
}
