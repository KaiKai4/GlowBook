import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "./env";

const URL_VALUE = "https://abcdefgh.supabase.co";
const ANON_VALUE = "anon-value-for-tests";
const SERVICE_VALUE = "service-value-for-tests";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabasePublicEnv", () => {
  it("devuelve la URL y la clave anónima cuando están definidas", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_VALUE);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_VALUE);

    expect(getSupabasePublicEnv()).toEqual({ url: URL_VALUE, anonKey: ANON_VALUE });
  });

  it("lanza un error con el nombre de la variable que falta", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_VALUE);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(() => getSupabasePublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("lanza si la URL no es válida, nombrando la variable pero sin mostrar su valor", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "no-es-una-url-secreta");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_VALUE);

    let thrown: unknown;
    try {
      getSupabasePublicEnv();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect((thrown as Error).message).not.toContain("no-es-una-url-secreta");
  });

  it("lee las variables al llamar, no al importar el módulo", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    expect(() => getSupabasePublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("getSupabaseServiceRoleKey", () => {
  it("devuelve la clave service_role cuando está definida", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_VALUE);

    expect(getSupabaseServiceRoleKey()).toBe(SERVICE_VALUE);
  });

  it("lanza con el nombre de la variable si falta, sin valores por defecto", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);

    expect(() => getSupabaseServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
