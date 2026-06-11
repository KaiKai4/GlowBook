import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, generateCspNonce } from "./csp";

describe("content security policy", () => {
  it("signs scripts with the nonce and never allows unsafe-inline scripts", () => {
    const csp = buildContentSecurityPolicy("abc123", false);

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("only allows eval in development", () => {
    expect(buildContentSecurityPolicy("n", true)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy("n", false)).not.toContain("'unsafe-eval'");
  });

  it("upgrades insecure requests only in production", () => {
    expect(buildContentSecurityPolicy("n", false)).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy("n", true)).not.toContain("upgrade-insecure-requests");
  });

  it("generates unique base64 nonces", () => {
    const first = generateCspNonce();
    const second = generateCspNonce();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(20);
  });
});
