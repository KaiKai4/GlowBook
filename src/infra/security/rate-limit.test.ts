import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { assertActionRateLimit } from "./rate-limit";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
const USER_ID = "7d1c9f0e-2b3a-4c5d-8e9f-0a1b2c3d4e5f";

function decision(allowed: boolean, retryAfter = 0) {
  return { data: [{ allowed, retry_after_seconds: retryAfter }], error: null };
}

describe("assertActionRateLimit", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    vi.mocked(captureError).mockClear();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc: rpcMock } as never);
  });

  it("allows the action when the shared store grants a slot", async () => {
    rpcMock.mockResolvedValue(decision(true));

    expect(await assertActionRateLimit(USER_ID, "appointments")).toEqual({ ok: true, value: undefined });
  });

  it("blocks the action when the shared store denies it", async () => {
    rpcMock.mockResolvedValue(decision(false, 12));

    expect(await assertActionRateLimit(USER_ID, "appointments")).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
  });

  it("sends the user and scope key, the limit and the window in seconds to the RPC", async () => {
    rpcMock.mockResolvedValue(decision(true));

    await assertActionRateLimit(USER_ID, "feedback", { max: 5, windowMs: 300_000 });

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: `user:${USER_ID}:feedback`,
      p_max: 5,
      p_window_seconds: 300,
    });
  });

  it("uses the default of 60 actions per minute", async () => {
    rpcMock.mockResolvedValue(decision(true));

    await assertActionRateLimit(USER_ID, "services");

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: `user:${USER_ID}:services`,
      p_max: 60,
      p_window_seconds: 60,
    });
  });

  it("fails open and captures the error when the store returns an error", async () => {
    const failure = { code: "XX000", message: "relation rate_limit_buckets does not exist" };
    rpcMock.mockResolvedValue({ data: null, error: failure });

    expect(await assertActionRateLimit(USER_ID, "retail")).toEqual({ ok: true, value: undefined });
    expect(captureError).toHaveBeenCalledWith(failure, {
      module: "security",
      action: "rate-limit",
      metadata: { scope: "retail", failMode: "open", severity: "high" },
    });
  });

  it("fails open when the admin client cannot be created", async () => {
    vi.mocked(createSupabaseAdminClient).mockImplementation(() => {
      throw new Error("supabaseUrl is required.");
    });

    expect((await assertActionRateLimit(USER_ID, "retail")).ok).toBe(true);
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("fails open and captures an empty decision", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    expect((await assertActionRateLimit(USER_ID, "retail")).ok).toBe(true);
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});

describe("rate limit key sanitization", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue(decision(true));
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc: rpcMock } as never);
  });

  async function sentKey(scope: string): Promise<string> {
    await assertActionRateLimit(USER_ID, scope);
    return rpcMock.mock.calls.at(-1)?.[1].p_key as string;
  }

  it("keeps safe characters untouched", async () => {
    expect(await sentKey("appointments")).toBe(`user:${USER_ID}:appointments`);
  });

  it("replaces unsafe characters with underscores", async () => {
    expect(await sentKey("a b'c\"d;DROP")).toBe(`user:${USER_ID}:a_b_c_d_DROP`);
  });

  it("hashes keys longer than the store limit and keeps them distinct", async () => {
    const longKey = await sentKey("x".repeat(250));
    expect(longKey).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await sentKey("x".repeat(250))).toBe(longKey);
    expect(await sentKey("x".repeat(251))).not.toBe(longKey);
  });
});
