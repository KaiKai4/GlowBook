import { describe, expect, it } from "vitest";
import { getOptimisticAuthDecision } from "./proxy-auth";

describe("getOptimisticAuthDecision", () => {
  it("never redirects the CSP report endpoint, even without a session", () => {
    expect(
      getOptimisticAuthDecision({
        pathname: "/api/csp-report",
        cookies: [],
      })
    ).toEqual({ type: "next" });
  });

  it("redirects protected routes to login when no Supabase auth cookie is present", () => {
    expect(
      getOptimisticAuthDecision({
        pathname: "/appointments",
        cookies: [],
      })
    ).toEqual({ type: "redirect", location: "/login" });
  });

  it("allows protected routes when a Supabase auth cookie is present", () => {
    expect(
      getOptimisticAuthDecision({
        pathname: "/appointments",
        cookies: [{ name: "sb-project-auth-token.0" }],
      })
    ).toEqual({ type: "next" });
  });

  it("redirects logged-in users away from login without blocking invitation routes", () => {
    expect(
      getOptimisticAuthDecision({
        pathname: "/login",
        cookies: [{ name: "sb-project-auth-token" }],
      })
    ).toEqual({ type: "redirect", location: "/" });

    expect(
      getOptimisticAuthDecision({
        pathname: "/invite/token-1",
        cookies: [{ name: "sb-project-auth-token" }],
      })
    ).toEqual({ type: "next" });
  });

  it("treats a stale auth cookie as unauthenticated after session verification", () => {
    expect(
      getOptimisticAuthDecision({
        pathname: "/appointments",
        cookies: [{ name: "sb-project-auth-token" }],
        hasVerifiedSession: false,
      })
    ).toEqual({ type: "redirect", location: "/login" });

    expect(
      getOptimisticAuthDecision({
        pathname: "/login",
        cookies: [{ name: "sb-project-auth-token" }],
        hasVerifiedSession: false,
      })
    ).toEqual({ type: "next" });
  });
});
