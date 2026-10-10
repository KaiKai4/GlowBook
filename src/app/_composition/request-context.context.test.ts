import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { getEffectiveDisabledSalonFeatures } from "@/features/billing";
import { getRolesEnabled, requireActionContext } from "./request-context";

// Contexto minimo de las acciones y lectura de rolesEnabled, con la misma
// sesion y tablas simuladas que el resto de pruebas del composition root.

const navigationMock = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => navigationMock);
vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  getEffectiveDisabledSalonFeatures: vi.fn(),
}));

const USER_ID = "7d1c9f0e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";
const SALON_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function queryFor(data: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function useSession(user: { id: string } | null, tables: Record<string, unknown>) {
  const from = vi.fn((table: string) => queryFor(tables[table] ?? null));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as never);
  return from;
}

function activeTables() {
  return {
    profiles: {
      id: USER_ID,
      salon_id: SALON_ID,
      role_id: null,
      is_owner: true,
      is_active: true,
      full_name: "Duena",
      salon: { disabled_features: [] },
      role: null,
    },
    salons: { id: SALON_ID, is_active: true },
  };
}

describe("requireActionContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue([]);
  });

  it("devuelve solo el contexto minimo que reciben los casos de uso, sin perfil", async () => {
    useSession({ id: USER_ID }, activeTables());

    const context = await requireActionContext();

    expect(context).toEqual({
      userId: USER_ID,
      salonId: SALON_ID,
      permissions: expect.any(Array),
      requestId: expect.any(String),
      rolesEnabled: true,
    });
  });

  it("calcula rolesEnabled a partir del plan efectivo: con el modulo de roles deshabilitado vale false", async () => {
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue(["roles"]);
    useSession({ id: USER_ID }, activeTables());

    const context = await requireActionContext();

    expect(context.rolesEnabled).toBe(false);
  });

  it("redirige a /login cuando no hay sesion", async () => {
    useSession(null, {});

    await expect(requireActionContext()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("getRolesEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue([]);
  });

  it("devuelve true cuando el plan incluye el modulo de roles", async () => {
    useSession({ id: USER_ID }, activeTables());

    await expect(getRolesEnabled()).resolves.toBe(true);
  });

  it("devuelve false sin sesion, sin consultar el plan", async () => {
    useSession(null, {});

    await expect(getRolesEnabled()).resolves.toBe(false);
    expect(getEffectiveDisabledSalonFeatures).not.toHaveBeenCalled();
  });
});
