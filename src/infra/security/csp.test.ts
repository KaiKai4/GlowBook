import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  CSP_REPORT_PATH,
  generateCspNonce,
  REPORTING_ENDPOINTS_HEADER,
} from "./csp";

describe("content security policy", () => {
  it("signs scripts with the nonce and never allows unsafe-inline scripts", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123", mode: "production" });

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("signs <style> elements with the nonce in production", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123", mode: "production" });

    expect(csp).toContain("style-src 'self' 'nonce-abc123';");
    expect(csp).not.toMatch(/style-src 'self' [^;]*'unsafe-inline'/);
  });

  it("only allows eval in development", () => {
    expect(buildContentSecurityPolicy({ nonce: "n", mode: "development" })).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ nonce: "n", mode: "production" })).not.toContain("'unsafe-eval'");
  });

  it("upgrades insecure requests only in production", () => {
    expect(buildContentSecurityPolicy({ nonce: "n", mode: "production" })).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ nonce: "n", mode: "development" })).not.toContain("upgrade-insecure-requests");
  });

  it("generates unique base64 nonces", () => {
    const first = generateCspNonce();
    const second = generateCspNonce();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(20);
  });

  it("sends violation reports to the report endpoint in both report-uri and report-to", () => {
    const csp = buildContentSecurityPolicy({ nonce: "n", mode: "production" });

    expect(csp).toContain(`report-uri ${CSP_REPORT_PATH}`);
    expect(csp).toContain("report-to csp-endpoint");
    expect(CSP_REPORT_PATH).toBe("/api/csp-report");
  });

  it("declares the csp-endpoint group in the Reporting-Endpoints header value", () => {
    expect(REPORTING_ENDPOINTS_HEADER).toBe('csp-endpoint="/api/csp-report"');
  });
});
