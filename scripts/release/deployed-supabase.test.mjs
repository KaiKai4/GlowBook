import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import { assertDeployedSupabaseMatches } from "../deployed-supabase-check.mjs";

const STAGING = "https://stagingref.supabase.co";
const PRODUCTION = "https://productionref.supabase.co";
const BASE = "https://staging.example";
afterEach(() => mock.restoreAll());

it("detecta el destino desde CSP cuando login solo usa Server Actions", async () => {
  mock.method(globalThis, "fetch", async () => new Response("<html>Login</html>", {
    headers: { "content-security-policy": "connect-src 'self' " + STAGING },
  }));
  assert.deepEqual(await assertDeployedSupabaseMatches({ baseUrl: BASE, expectedUrl: STAGING }), [STAGING]);
});

it("rechaza mezcla de runtime staging y bundle de producción", async () => {
  mock.method(globalThis, "fetch", async () => new Response(PRODUCTION, {
    headers: { "content-security-policy": "connect-src 'self' " + STAGING },
  }));
  await assert.rejects(assertDeployedSupabaseMatches({ baseUrl: BASE, expectedUrl: STAGING }), /mismatch/);
});

it("no acepta la CSP wildcard como evidencia del proyecto", async () => {
  mock.method(globalThis, "fetch", async () => new Response("Login", {
    headers: { "content-security-policy": "connect-src https://*.supabase.co" },
  }));
  await assert.rejects(assertDeployedSupabaseMatches({ baseUrl: BASE, expectedUrl: STAGING }), /Could not detect/);
});

it("conserva la detección del bundle y rechaza el proyecto equivocado", async () => {
  mock.method(globalThis, "fetch", async (/** @type {RequestInfo | URL} */ url) => new Response(
    String(url).endsWith("/login") ? '<script src="/chunk.js"></script>' : PRODUCTION,
  ));
  await assert.rejects(assertDeployedSupabaseMatches({ baseUrl: BASE, expectedUrl: STAGING }), /mismatch/);
});
