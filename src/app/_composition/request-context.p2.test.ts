import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileWithRole } from "@/types/app.types";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { getEffectiveDisabledSalonFeatures } from "@/features/billing/use-cases/commercial-plans";
import {
  getProfile,
  isPlatformAdmin,
  requireActiveProfile,
  requirePlatformAdmin,
  requireProfile,
} from "./request-context";

const navigationMock = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => navigationMock);
vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  getEffectiveDisabledSalonFeatures: vi.fn(),
}));

const USER_ID = "7d1c9f0e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";
const SALON_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

type Result = { data: unknown; error?: unknown };

// Cliente de sesion: el usuario actual y una tabla de respuestas por nombre.
function serverClient(user: { id: string } | null, tables: Record<string, Result> = {}) {
  const from = vi.fn((table: string) => queryFor(tables[table] ?? { data: null }));
  return {
    client: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, from },
    from,
  };
}

// Consulta encadenable (select/eq) que termina en single() o maybeSingle().
function queryFor(result: Result) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function profile(overrides: Partial<ProfileWithRole> = {}): ProfileWithRole {
  return {
    id: USER_ID,
    salon_id: SALON_ID,
    role_id: "role-1",
    is_owner: true,
    is_active: true,
    full_name: "Dueña",
    salon: { disabled_features: [] },
    role: null,
    ...overrides,
  } as unknown as ProfileWithRole;
}

function useServer(user: { id: string } | null, tables: Record<string, Result> = {}) {
  const server = serverClient(user, tables);
  vi.mocked(createSupabaseServerClient).mockResolvedValue(server.client as never);
  return server;
}

function useAdmin(platformRow: unknown) {
  const from = vi.fn(() => queryFor({ data: platformRow }));
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return from;
}

describe("getProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue(["inventory"]);
  });

  it("returns null without querying profiles when nobody is signed in", async () => {
    const server = useServer(null);

    expect(await getProfile()).toBeNull();
    expect(server.from).not.toHaveBeenCalled();
  });

  it("returns null when the profile row does not exist", async () => {
    useServer({ id: USER_ID }, { profiles: { data: null } });

    expect(await getProfile()).toBeNull();
  });

  it("loads the profile of the signed-in user and replaces the salon features with the effective ones", async () => {
    const raw = profile({ salon: { disabled_features: ["legacy"] } as never });
    const server = useServer({ id: USER_ID }, { profiles: { data: raw } });

    const result = await getProfile();

    expect(server.from).toHaveBeenCalledWith("profiles");
    expect(getEffectiveDisabledSalonFeatures).toHaveBeenCalledWith(raw);
    expect(result).toMatchObject({
      id: USER_ID,
      salon_id: SALON_ID,
      salon: { disabled_features: ["inventory"] },
    });
  });
});

describe("requireProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue([]);
  });

  it("redirects to /login when there is no profile", async () => {
    useServer(null);

    await expect(requireProfile()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(navigationMock.redirect).toHaveBeenCalledWith("/login");
  });

  it("returns the profile when it exists", async () => {
    useServer({ id: USER_ID }, { profiles: { data: profile() } });

    expect(await requireProfile()).toMatchObject({ id: USER_ID });
  });
});

describe("requireActiveProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue([]);
  });

  it("redirects to /login when the profile is inactive", async () => {
    useServer({ id: USER_ID }, { profiles: { data: profile({ is_active: false }) } });

    await expect(requireActiveProfile()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the salon of the profile is not found", async () => {
    useServer(
      { id: USER_ID },
      { profiles: { data: profile() }, salons: { data: null } }
    );

    await expect(requireActiveProfile()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to / when the salon is suspended", async () => {
    useServer(
      { id: USER_ID },
      { profiles: { data: profile() }, salons: { data: { id: SALON_ID, is_active: false } } }
    );

    await expect(requireActiveProfile()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(navigationMock.redirect).toHaveBeenLastCalledWith("/");
  });

  it("returns the profile when the profile and its salon are active", async () => {
    useServer(
      { id: USER_ID },
      { profiles: { data: profile() }, salons: { data: { id: SALON_ID, is_active: true } } }
    );

    expect(await requireActiveProfile()).toMatchObject({ id: USER_ID, salon_id: SALON_ID });
    expect(navigationMock.redirect).not.toHaveBeenCalled();
  });
});

describe("isPlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false without checking the admin table when nobody is signed in", async () => {
    useServer(null);
    const adminFrom = useAdmin({ user_id: USER_ID });

    expect(await isPlatformAdmin()).toBe(false);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("returns false when the user is not listed in platform_admins", async () => {
    useServer({ id: USER_ID });
    const adminFrom = useAdmin(null);

    expect(await isPlatformAdmin()).toBe(false);
    expect(adminFrom).toHaveBeenCalledWith("platform_admins");
  });

  it("returns true when the user is listed in platform_admins", async () => {
    useServer({ id: USER_ID });
    useAdmin({ user_id: USER_ID });

    expect(await isPlatformAdmin()).toBe(true);
  });
});

describe("requirePlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when nobody is signed in", async () => {
    useServer(null);
    useAdmin({ user_id: USER_ID });

    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the user is not a platform admin", async () => {
    useServer({ id: USER_ID });
    useAdmin(null);

    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("returns the user id when the user is a platform admin", async () => {
    useServer({ id: USER_ID });
    useAdmin({ user_id: USER_ID });

    expect(await requirePlatformAdmin()).toBe(USER_ID);
  });
});
