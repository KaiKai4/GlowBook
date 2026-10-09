// Tests del smoke con cabecera de bypass y de la extracción de la URL de despliegue.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCheck, resolveCheckUrl } from "../quality/synthetic-check.mjs";
import { BYPASS_HEADER, withBypassHeader } from "./smoke.mjs";
import { extractDeploymentUrl, isVercelDeployUrl } from "./deployment-url.mjs";

describe("withBypassHeader", () => {
  it("devuelve el mismo fetch cuando no hay secreto", () => {
    const base = /** @type {typeof fetch} */ (async () => new Response("ok"));
    assert.equal(withBypassHeader(base, undefined), base);
    assert.equal(withBypassHeader(base, "   "), base);
  });

  it("añade la cabecera de bypass sin perder las demás", async () => {
    /** @type {Headers | undefined} */
    let seen;
    const base = /** @type {typeof fetch} */ (async (_input, init) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    });
    const wrapped = withBypassHeader(base, "SECRETO-PRUEBA");
    await wrapped("https://app.example.com/login", { headers: { accept: "text/html" } });
    assert.equal(seen?.get(BYPASS_HEADER), "SECRETO-PRUEBA");
    assert.equal(seen?.get("accept"), "text/html");
  });

  it("runCheck usa el fetch envuelto y valida 200 con cabeceras de seguridad", async () => {
    const headers = new Headers({
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=()",
      "content-security-policy": "default-src 'self'",
      "strict-transport-security": "max-age=63072000",
      "x-request-id": "123e4567-e89b-42d3-a456-426614174000",
    });
    /** @type {string | null} */
    let bypass = null;
    const base = /** @type {typeof fetch} */ (async (_input, init) => {
      bypass = new Headers(init?.headers).get(BYPASS_HEADER);
      return new Response("ok", { status: 200, headers });
    });
    const url = resolveCheckUrl("https://app.example.com");
    const result = await runCheck(url, withBypassHeader(base, "X"));
    assert.equal(result.ok, true);
    assert.equal(bypass, "X");
  });
});

describe("extractDeploymentUrl", () => {
  it("toma la última URL *.vercel.app de la salida de la CLI", () => {
    const output = [
      "Inspect: https://vercel.com/org/proj/abc123 [1s]",
      "Preview: https://glowbook-git-main.vercel.app",
      "Production: https://glowbook-xyz789.vercel.app.",
    ].join("\n");
    assert.equal(extractDeploymentUrl(output), "https://glowbook-xyz789.vercel.app");
  });

  it("devuelve null si no hay URL de despliegue", () => {
    assert.equal(extractDeploymentUrl("Error: no autorizado"), null);
    assert.equal(extractDeploymentUrl("https://evil.example.com"), null);
  });

  it("valida que la URL sea https sobre *.vercel.app", () => {
    assert.equal(isVercelDeployUrl("https://x.vercel.app/"), true);
    assert.equal(isVercelDeployUrl("http://x.vercel.app/"), false);
    assert.equal(isVercelDeployUrl("https://x.vercel.app/ruta"), false);
    assert.equal(isVercelDeployUrl("https://x.example.com/"), false);
  });
});
