import { PostgrestError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBillingSupabaseFake } from "@/test/billing-feature-supabase";
import { billingDb, countOrThrow, rowsOrThrow, throwOnError } from "./billing-db";

// Cliente de billing y helpers de resultado: normalizan null a lista/cero y
// lanzan el error original de la base cuando la consulta falla.

const admin = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: admin.factory,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("billingDb", () => {
  it("devuelve el cliente admin (service_role) creado por la factoría", () => {
    const fake = createBillingSupabaseFake();
    admin.factory.mockReturnValueOnce(fake);

    expect(billingDb()).toBe(fake);
    expect(admin.factory).toHaveBeenCalledTimes(1);
  });
});

describe("rowsOrThrow", () => {
  it("devuelve las filas de la consulta", () => {
    expect(rowsOrThrow({ data: [{ id: "p1" }], error: null })).toEqual([{ id: "p1" }]);
  });

  it("devuelve una lista vacía cuando no hay datos", () => {
    expect(rowsOrThrow({ data: null, error: null })).toEqual([]);
  });

  it("lanza el error original de la base cuando la consulta falla", () => {
    const failure = new PostgrestError({ message: "fallo de lectura", details: "", hint: "", code: "42501" });
    expect(() => rowsOrThrow({ data: null, error: failure })).toThrow(failure);
  });
});

describe("countOrThrow", () => {
  it("devuelve el conteo y normaliza null a cero", () => {
    expect(countOrThrow({ count: 7, error: null })).toBe(7);
    expect(countOrThrow({ count: null, error: null })).toBe(0);
  });
});

describe("throwOnError", () => {
  it("no hace nada sin error y lanza el error original cuando falla", () => {
    expect(() => throwOnError({ error: null })).not.toThrow();

    const failure = new PostgrestError({ message: "violación de constraint", details: "", hint: "", code: "23505" });
    expect(() => throwOnError({ error: failure })).toThrow(failure);
  });
});
