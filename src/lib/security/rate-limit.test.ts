import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "./rate-limit";

describe("rate limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests below the limit", () => {
    const options = { max: 3, windowMs: 60_000 };

    expect(checkRateLimit("k", options, 0).allowed).toBe(true);
    expect(checkRateLimit("k", options, 10).allowed).toBe(true);
    expect(checkRateLimit("k", options, 20).allowed).toBe(true);
  });

  it("blocks once the window limit is exceeded and reports retry time", () => {
    const options = { max: 2, windowMs: 60_000 };
    checkRateLimit("k", options, 0);
    checkRateLimit("k", options, 0);

    const blocked = checkRateLimit("k", options, 30_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(30);
  });

  it("resets the counter when the window expires", () => {
    const options = { max: 1, windowMs: 60_000 };
    checkRateLimit("k", options, 0);
    expect(checkRateLimit("k", options, 1_000).allowed).toBe(false);

    expect(checkRateLimit("k", options, 61_000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const options = { max: 1, windowMs: 60_000 };
    checkRateLimit("a", options, 0);

    expect(checkRateLimit("b", options, 0).allowed).toBe(true);
    expect(checkRateLimit("a", options, 0).allowed).toBe(false);
  });
});
