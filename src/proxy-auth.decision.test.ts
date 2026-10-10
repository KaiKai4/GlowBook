import { describe, expect, it } from "vitest";
import { getOptimisticAuthDecision, hasSupabaseSessionCookie } from "./proxy-auth";

const CSP_REPORT = "/api/csp-report";

describe("hasSupabaseSessionCookie", () => {
  it.each([
    ["sb-project-auth-token"],
    ["sb-project-auth-token.0"],
    ["sb-project-auth-token.12"],
  ])("recognizes the Supabase session cookie %s", (name) => {
    expect(hasSupabaseSessionCookie([{ name }])).toBe(true);
  });

  it.each([
    ["auth-token"],
    ["sb-project-session"],
    ["sb-project-auth-token.x"],
    ["other-auth-token"],
  ])("ignores the cookie %s, which is not a Supabase session cookie", (name) => {
    expect(hasSupabaseSessionCookie([{ name }])).toBe(false);
  });

  it("returns false when there are no cookies", () => {
    expect(hasSupabaseSessionCookie([])).toBe(false);
  });
});

describe("getOptimisticAuthDecision", () => {
  it("never redirects the CSP report endpoint, even without a session", () => {
    expect(getOptimisticAuthDecision({ pathname: CSP_REPORT, cookies: [] })).toEqual({ type: "next" });
  });

  it("redirects an anonymous user from a private page to /login", () => {
    expect(getOptimisticAuthDecision({ pathname: "/clientes", cookies: [] })).toEqual({
      type: "redirect",
      location: "/login",
    });
  });

  it.each(["/invite/abc", "/join/xyz", "/forgot-password", "/reset-password", "/login"])(
    "lets an anonymous user reach the public auth route %s",
    (pathname) => {
      expect(getOptimisticAuthDecision({ pathname, cookies: [] })).toEqual({ type: "next" });
    }
  );

  it("sends a signed-in user away from /login and /join to the dashboard", () => {
    const cookies = [{ name: "sb-project-auth-token" }];

    expect(getOptimisticAuthDecision({ pathname: "/login", cookies })).toEqual({
      type: "redirect",
      location: "/",
    });
    expect(getOptimisticAuthDecision({ pathname: "/join/xyz", cookies })).toEqual({
      type: "redirect",
      location: "/",
    });
  });

  it("keeps a signed-in user on private pages", () => {
    const cookies = [{ name: "sb-project-auth-token" }];

    expect(getOptimisticAuthDecision({ pathname: "/clientes", cookies })).toEqual({ type: "next" });
  });

  it("trusts the verified session over the cookie when the verification is known", () => {
    expect(
      getOptimisticAuthDecision({ pathname: "/clientes", cookies: [], hasVerifiedSession: true })
    ).toEqual({ type: "next" });
    expect(
      getOptimisticAuthDecision({
        pathname: "/login",
        cookies: [{ name: "sb-project-auth-token" }],
        hasVerifiedSession: false,
      })
    ).toEqual({ type: "next" });
  });
});
