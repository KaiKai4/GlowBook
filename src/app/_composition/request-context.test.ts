import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireActiveProfile } from "./request-context";
import { createSupabaseServerClient } from "@/infra/supabase/server";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const mockedCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

const activeProfile = {
  id: "user-1",
  salon_id: "salon-1",
  role_id: null,
  is_owner: true,
  full_name: "Owner Test",
  is_active: true,
  role: null,
};

function supabaseMock({
  user = { id: "user-1" },
  profile = activeProfile,
  salon = { id: "salon-1", is_active: true },
}: {
  user?: { id: string } | null;
  profile?: typeof activeProfile | null;
  salon?: { id: string; is_active: boolean } | null;
}) {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user } }),
  };

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: profile }),
      };
    }

    if (table === "salons") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: salon }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { auth, from };
}

describe("requireActiveProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the profile when profile and salon are active", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue(supabaseMock({}) as never);

    await expect(requireActiveProfile()).resolves.toMatchObject({
      id: "user-1",
      salon_id: "salon-1",
      is_active: true,
    });
  });

  it("redirects to login when the profile is inactive", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock({ profile: { ...activeProfile, is_active: false } }) as never
    );

    await expect(requireActiveProfile()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to the dashboard shell when the salon is suspended", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue(
      supabaseMock({ salon: { id: "salon-1", is_active: false } }) as never
    );

    await expect(requireActiveProfile()).rejects.toThrow("REDIRECT:/");
  });

  it("redirects to login when the salon no longer exists", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue(supabaseMock({ salon: null }) as never);

    await expect(requireActiveProfile()).rejects.toThrow("REDIRECT:/login");
  });
});
