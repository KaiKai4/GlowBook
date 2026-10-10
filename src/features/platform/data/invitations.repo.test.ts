import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashInvitationToken } from "@/infra/auth/invitation-tokens";
import {
  acceptSalonInvitationAsAdmin,
  createSalonInvitation,
  findAcceptedInvitationEmailBySalon,
  findPendingInvitations,
  findRecentAcceptedInvitations,
  profileExists,
  regenerateSalonInvitationToken,
} from "./invitations.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Conducta de los repositorios de invitaciones: el token en claro nunca se
// persiste (solo su hash), las lecturas de la plataforma usan el cliente admin
// y cada consulta acota por el estado o por el salón que corresponde.

const clients = vi.hoisted(() => ({
  admin: null as FakeSupabase | null,
  server: null as FakeSupabase | null,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => clients.server,
}));

const EMAIL = "owner@example.com";
const PLAN_ID = "00000000-0000-4000-8000-00000000000a";
const SALON_ID = "00000000-0000-4000-8000-000000000001";
const INVITATION_ID = "00000000-0000-4000-8000-0000000000bb";

function useClients(admin: FakeSupabase, server: FakeSupabase = createFakeSupabase()) {
  clients.admin = admin;
  clients.server = server;
  return admin;
}

beforeEach(() => {
  vi.useRealTimers();
  clients.admin = null;
  clients.server = null;
});

describe("createSalonInvitation", () => {
  it("delegates token creation to the invite_salon RPC on the caller session", async () => {
    const server = createFakeSupabase({
      rpc: { invite_salon: { data: "raw-token", error: null } },
    });
    const admin = useClients(createFakeSupabase(), server);

    const token = await createSalonInvitation(EMAIL, null);

    expect(token).toBe("raw-token");
    // Sin plan no se envia p_plan_id: la RPC aplica su default (null).
    expect(server.rpc).toHaveBeenCalledWith("invite_salon", { p_email: EMAIL });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("sends the plan inside the same invite_salon RPC, with no second write", async () => {
    const server = createFakeSupabase({
      rpc: { invite_salon: { data: "raw-token", error: null } },
    });
    const admin = useClients(createFakeSupabase(), server);

    const token = await createSalonInvitation(EMAIL, PLAN_ID);

    expect(token).toBe("raw-token");
    expect(server.rpc).toHaveBeenCalledWith("invite_salon", { p_email: EMAIL, p_plan_id: PLAN_ID });
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("propagates RPC failures without writing a plan", async () => {
    const rpcError = { message: "rpc down" };
    const server = createFakeSupabase({ rpc: { invite_salon: { data: null, error: rpcError } } });
    const admin = useClients(createFakeSupabase(), server);

    await expect(createSalonInvitation(EMAIL, PLAN_ID)).rejects.toBe(rpcError);
    expect(admin.from).not.toHaveBeenCalled();
  });
});

describe("regenerateSalonInvitationToken", () => {
  it("issues a new token, stores only its hash and extends expiry 14 days from now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const admin = useClients(
      createFakeSupabase({ tables: { salon_invitations: { data: { id: INVITATION_ID }, error: null } } })
    );

    const token = await regenerateSalonInvitationToken(INVITATION_ID);

    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(argsOf(queryFor(admin, "salon_invitations"), "update")).toEqual([
      [
        {
          token_hash: hashInvitationToken(token),
          expires_at: "2026-06-15T12:00:00.000Z",
        },
      ],
    ]);
  });

  it("only updates the invitation with that id while it is still pending", async () => {
    const admin = useClients(
      createFakeSupabase({ tables: { salon_invitations: { data: { id: INVITATION_ID }, error: null } } })
    );

    await regenerateSalonInvitationToken(INVITATION_ID);

    const query = queryFor(admin, "salon_invitations");
    expect(argsOf(query, "eq")).toEqual([
      ["id", INVITATION_ID],
      ["status", "pending"],
    ]);
    expect(argsOf(query, "select")).toEqual([["id"]]);
  });

  it("refuses when no pending invitation matches, so an accepted link cannot be reissued", async () => {
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: null } } }));

    await expect(regenerateSalonInvitationToken(INVITATION_ID)).rejects.toThrow(
      "La invitación no existe o ya no está pendiente."
    );
  });

  it("propagates database errors", async () => {
    const dbError = { message: "boom" };
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: dbError } } }));

    await expect(regenerateSalonInvitationToken(INVITATION_ID)).rejects.toBe(dbError);
  });
});

describe("findPendingInvitations", () => {
  it("lists only pending invitations, newest first, with the public columns", async () => {
    const rows = [{ id: "i-1", email: EMAIL, status: "pending" }];
    const admin = useClients(
      createFakeSupabase({ tables: { salon_invitations: { data: rows, error: null } } })
    );

    await expect(findPendingInvitations()).resolves.toEqual(rows);

    const query = queryFor(admin, "salon_invitations");
    expect(argsOf(query, "select")).toEqual([["id, email, status, expires_at, created_at, plan_id"]]);
    expect(argsOf(query, "eq")).toEqual([["status", "pending"]]);
    expect(argsOf(query, "order")).toEqual([["created_at", { ascending: false }]]);
  });

  it("returns an empty list when the adapter returns no data", async () => {
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: null } } }));

    await expect(findPendingInvitations()).resolves.toEqual([]);
  });

  it("throws database errors", async () => {
    const dbError = { message: "denied" };
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: dbError } } }));

    await expect(findPendingInvitations()).rejects.toBe(dbError);
  });
});

describe("findRecentAcceptedInvitations", () => {
  it("limits accepted invitations to the 10 most recent by default", async () => {
    const admin = useClients(createFakeSupabase());

    await findRecentAcceptedInvitations();

    const query = queryFor(admin, "salon_invitations");
    expect(argsOf(query, "eq")).toEqual([["status", "accepted"]]);
    expect(argsOf(query, "order")).toEqual([["accepted_at", { ascending: false }]]);
    expect(argsOf(query, "limit")).toEqual([[10]]);
  });

  it("honours an explicit limit", async () => {
    const admin = useClients(createFakeSupabase());

    await findRecentAcceptedInvitations(3);

    expect(argsOf(queryFor(admin, "salon_invitations"), "limit")).toEqual([[3]]);
  });

  it("returns an empty list on null data and throws on errors", async () => {
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: null } } }));
    await expect(findRecentAcceptedInvitations()).resolves.toEqual([]);

    const dbError = { message: "denied" };
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: dbError } } }));
    await expect(findRecentAcceptedInvitations()).rejects.toBe(dbError);
  });
});

describe("findAcceptedInvitationEmailBySalon", () => {
  it("skips the query entirely when there are no salons", async () => {
    const admin = useClients(createFakeSupabase());

    const result = await findAcceptedInvitationEmailBySalon([]);

    expect(result.size).toBe(0);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("keeps the most recently accepted email per salón and ignores rows without salón or email", async () => {
    const admin = useClients(
      createFakeSupabase({
        tables: {
          salon_invitations: {
            data: [
              { salon_id: SALON_ID, email: "new@example.com", accepted_at: "2026-06-02" },
              { salon_id: SALON_ID, email: "old@example.com", accepted_at: "2026-05-01" },
              { salon_id: null, email: "orphan@example.com", accepted_at: "2026-06-03" },
              { salon_id: "salon-2", email: "", accepted_at: "2026-06-03" },
            ],
            error: null,
          },
        },
      })
    );

    const result = await findAcceptedInvitationEmailBySalon([SALON_ID, "salon-2"]);

    expect(result).toEqual(new Map([[SALON_ID, "new@example.com"]]));
    const query = queryFor(admin, "salon_invitations");
    expect(argsOf(query, "in")).toEqual([["salon_id", [SALON_ID, "salon-2"]]]);
    expect(argsOf(query, "eq")).toEqual([["status", "accepted"]]);
  });

  it("returns an empty map on null data and throws on errors", async () => {
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: null } } }));
    await expect(findAcceptedInvitationEmailBySalon([SALON_ID])).resolves.toEqual(new Map());

    const dbError = { message: "denied" };
    useClients(createFakeSupabase({ tables: { salon_invitations: { data: null, error: dbError } } }));
    await expect(findAcceptedInvitationEmailBySalon([SALON_ID])).rejects.toBe(dbError);
  });
});

describe("profileExists", () => {
  it("reports true when a profile row comes back for that id", async () => {
    const admin = useClients(
      createFakeSupabase({ tables: { profiles: { data: { id: "user-1" }, error: null } } })
    );

    await expect(profileExists("user-1")).resolves.toBe(true);
    expect(argsOf(queryFor(admin, "profiles"), "eq")).toEqual([["id", "user-1"]]);
  });

  it("reports false when no profile exists", async () => {
    useClients(createFakeSupabase({ tables: { profiles: { data: null, error: null } } }));

    await expect(profileExists("user-1")).resolves.toBe(false);
  });

  it("throws when the lookup fails instead of guessing", async () => {
    const dbError = { message: "denied" };
    useClients(createFakeSupabase({ tables: { profiles: { data: null, error: dbError } } }));

    await expect(profileExists("user-1")).rejects.toBe(dbError);
  });
});

describe("acceptSalonInvitationAsAdmin", () => {
  it("calls the privileged accept RPC with the token, user and onboarding fields", async () => {
    const admin = useClients(
      createFakeSupabase({ rpc: { accept_invitation_admin: { data: SALON_ID, error: null } } })
    );

    const salonId = await acceptSalonInvitationAsAdmin({
      token: "raw-token",
      userId: "user-1",
      email: EMAIL,
      salonName: "Glow",
      fullName: "Ana Owner",
    });

    expect(salonId).toBe(SALON_ID);
    expect(admin.rpc).toHaveBeenCalledWith("accept_invitation_admin", {
      p_token: "raw-token",
      p_user_id: "user-1",
      p_email: EMAIL,
      p_salon_name: "Glow",
      p_full_name: "Ana Owner",
    });
  });

  it("propagates RPC failures so the use case can roll back the created owner", async () => {
    const rpcError = { message: "duplicate key" };
    useClients(createFakeSupabase({ rpc: { accept_invitation_admin: { data: null, error: rpcError } } }));

    await expect(
      acceptSalonInvitationAsAdmin({
        token: "t",
        userId: "u",
        email: EMAIL,
        salonName: "Glow",
        fullName: "Ana",
      })
    ).rejects.toBe(rpcError);
  });
});
