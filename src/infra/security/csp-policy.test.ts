import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, generateCspNonce } from "./csp";

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function directive(policy: string, name: string): string | undefined {
  return policy.split("; ").find((item) => item.startsWith(`${name} `) || item === name);
}

describe("connect-src origin for the Supabase project", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  afterEach(() => {
    if (ORIGINAL_SUPABASE_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
  });

  it("falls back to the wildcard Supabase origin when the env var is missing", () => {
    expect(directive(buildContentSecurityPolicy("n", false), "connect-src")).toBe(
      "connect-src 'self' https://*.supabase.co https://*.supabase.co wss://*.supabase.co"
    );
  });

  it("falls back to the wildcard origin when the env var is not a valid URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "no-es-una-url";
    expect(directive(buildContentSecurityPolicy("n", false), "connect-src")).toBe(
      "connect-src 'self' https://*.supabase.co https://*.supabase.co wss://*.supabase.co"
    );
  });

  it("keeps only the origin of a valid project URL, dropping path and query", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co/rest/v1/?x=1";
    expect(directive(buildContentSecurityPolicy("n", false), "connect-src")).toBe(
      "connect-src 'self' https://proyecto.supabase.co https://*.supabase.co wss://*.supabase.co"
    );
  });
});

describe("buildContentSecurityPolicy directives", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
  });

  afterEach(() => {
    if (ORIGINAL_SUPABASE_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
  });

  it("restricts defaults and forms to self and blocks framing and plugins", () => {
    const policy = buildContentSecurityPolicy("n", false);

    expect(directive(policy, "default-src")).toBe("default-src 'self'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("allows images from any https origin and data/blob URIs", () => {
    expect(directive(buildContentSecurityPolicy("n", false), "img-src")).toBe(
      "img-src 'self' data: blob: https:"
    );
  });

  it("keeps unsafe-inline only for styles, never for scripts", () => {
    const policy = buildContentSecurityPolicy("n", false);

    expect(directive(policy, "style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'nonce-n' 'strict-dynamic'");
  });

  it("connects to the configured Supabase project over https and wss", () => {
    expect(directive(buildContentSecurityPolicy("n", false), "connect-src")).toBe(
      "connect-src 'self' https://proyecto.supabase.co https://*.supabase.co wss://*.supabase.co"
    );
  });

  it("uses the wildcard origin in connect-src when no project URL is configured", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(directive(buildContentSecurityPolicy("n", false), "connect-src")).toBe(
      "connect-src 'self' https://*.supabase.co https://*.supabase.co wss://*.supabase.co"
    );
  });

  it("embeds the nonce verbatim in script-src", () => {
    const nonce = generateCspNonce();
    expect(buildContentSecurityPolicy(nonce, true)).toContain(`'nonce-${nonce}'`);
  });

  it("in development adds unsafe-eval to script-src and skips upgrade-insecure-requests", () => {
    const policy = buildContentSecurityPolicy("n", true);

    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-n' 'strict-dynamic' 'unsafe-eval'"
    );
    expect(policy.split("; ")).not.toContain("upgrade-insecure-requests");
  });

  it("in production appends upgrade-insecure-requests as the last directive", () => {
    const parts = buildContentSecurityPolicy("n", false).split("; ");

    expect(parts[parts.length - 1]).toBe("upgrade-insecure-requests");
  });
});

describe("generateCspNonce", () => {
  it("produces base64 text that is not a plain UUID", () => {
    const nonce = generateCspNonce();

    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(Buffer.from(nonce, "base64").toString("utf8")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
