import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(() => ({ fake: true })),
  cookieStore: {
    getAll: vi.fn(() => []),
    get: vi.fn(() => undefined),
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: async () => mocks.cookieStore,
}));

import { createSupabaseServerClient } from "./server";

const URL_VALUE = "https://proyecto.supabase.co";
const ANON_VALUE = "clave-publica-de-prueba";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_VALUE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_VALUE);
  mocks.createServerClient.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSupabaseServerClient", () => {
  it("crea el cliente con la URL y la clave anonima publicas", async () => {
    const client = await createSupabaseServerClient();

    expect(client).toEqual({ fake: true });
    expect(mocks.createServerClient).toHaveBeenCalledTimes(1);
    const [url, key] = mocks.createServerClient.mock.calls[0] as unknown as [string, string];
    expect(url).toBe(URL_VALUE);
    expect(key).toBe(ANON_VALUE);
  });

  it("lanza nombrando la variable ausente, sin valores", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(createSupabaseServerClient()).rejects.toThrow(
      "Variable de entorno ausente o inválida: NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});
