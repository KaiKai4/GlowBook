import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashInvitationToken } from "@/lib/auth/invitation-tokens";
import { findSalonInvitationForAcceptance } from "./invitations.repo";

// La base solo conoce el sha256 del token: la consulta de aceptacion debe
// filtrar por token_hash y nunca por el token en claro.

// Doble del cliente admin: este test no importa @/lib/supabase/admin (ADR 0010).
const adminClient = vi.hoisted(() => ({ from: vi.fn<(table: string) => unknown>() }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

function queryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  adminClient.from.mockReturnValue(builder);
  return { from: adminClient.from, ...builder };
}

const TOKEN = "f3a1".repeat(12);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findSalonInvitationForAcceptance", () => {
  it("looks the invitation up by the sha256 of the token, never by the raw token", async () => {
    const query = queryBuilder({ data: null, error: null });

    await findSalonInvitationForAcceptance(TOKEN);

    expect(query.from).toHaveBeenCalledWith("salon_invitations");
    expect(query.eq).toHaveBeenCalledWith("token_hash", hashInvitationToken(TOKEN));
    expect(query.eq).not.toHaveBeenCalledWith("token_hash", TOKEN);
  });

  it("selects only the fields needed to accept the invitation", async () => {
    const query = queryBuilder({ data: null, error: null });

    await findSalonInvitationForAcceptance(TOKEN);

    expect(query.select).toHaveBeenCalledWith("email, status, expires_at, plan_id");
  });

  it("returns null when no invitation matches the hash", async () => {
    queryBuilder({ data: null, error: null });

    await expect(findSalonInvitationForAcceptance(TOKEN)).resolves.toBeNull();
  });

  it("returns the matched invitation row", async () => {
    const row = {
      email: "owner@example.com",
      status: "pending",
      expires_at: "2099-01-01T00:00:00.000Z",
      plan_id: null,
    };
    queryBuilder({ data: row, error: null });

    await expect(findSalonInvitationForAcceptance(TOKEN)).resolves.toEqual(row);
  });

  it("throws database errors so the caller can report a verification failure", async () => {
    const dbError = new Error("permission denied");
    queryBuilder({ data: null, error: dbError });

    await expect(findSalonInvitationForAcceptance(TOKEN)).rejects.toBe(dbError);
  });
});
