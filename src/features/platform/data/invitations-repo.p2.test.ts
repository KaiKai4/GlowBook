import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { regenerateSalonInvitationToken } from "./invitations.repo";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const INVITATION = "00000000-0000-4000-8000-0000000000d1";

type Reply = { data?: unknown; error?: unknown };

// Cliente admin minimo: cada from(tabla) consume la siguiente respuesta de su cola.
function fakeAdmin(replies: Reply[]) {
  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    for (const method of ["update", "eq", "select"]) {
      builder[method] = (...args: unknown[]) => {
        if (method === "update") lastUpdate.push(args[0]);
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(replies.shift() ?? { data: null, error: null });
    return builder;
  });
  return { from };
}

const lastUpdate: unknown[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  lastUpdate.length = 0;
});

describe("regenerateSalonInvitationToken", () => {
  it("devuelve un token nuevo y guarda solo su hash con caducidad de 14 dias", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fakeAdmin([{ data: { id: INVITATION }, error: null }]) as never);

    const token = await regenerateSalonInvitationToken(INVITATION);

    expect(token).toMatch(/\S{16,}/);
    const [update] = lastUpdate as Array<{ token_hash: string; expires_at: string }>;
    expect(update?.token_hash).toBeTypeOf("string");
    expect(update?.token_hash).not.toBe(token);
    const expiresInDays = (Date.parse(update?.expires_at ?? "") - Date.now()) / 86_400_000;
    expect(expiresInDays).toBeGreaterThan(13.9);
    expect(expiresInDays).toBeLessThanOrEqual(14.01);
  });

  it("una invitacion que ya no esta pendiente lanza el mensaje de dominio", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fakeAdmin([{ data: null, error: null }]) as never);

    await expect(regenerateSalonInvitationToken(INVITATION)).rejects.toThrow(
      "La invitacion no existe o ya no esta pendiente."
    );
  });

  it("un error de la base se propaga sin convertirlo en mensaje de dominio", async () => {
    const failure = { code: "XX000", message: "connection reset" };
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fakeAdmin([{ data: null, error: failure }]) as never);

    await expect(regenerateSalonInvitationToken(INVITATION)).rejects.toBe(failure);
  });
});
