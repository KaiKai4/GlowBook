// Tests del check sintético contra un servidor HTTP local efímero.
// Ejecución: node --test scripts/ops/synthetic-check.test.mjs

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { evaluateHeaders, resolveCheckUrl, runCheck } from "../quality/synthetic-check.mjs";

const VALID_REQUEST_ID = "3f2c8a1e-9b4d-4e7a-8c2f-1a2b3c4d5e6f";

/** @type {Record<string, string>} */
const SECURE_HEADERS = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=()",
  "content-security-policy": "default-src 'self'",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-request-id": VALID_REQUEST_ID,
};

/**
 * Servidor de prueba: responde con el estado y cabeceras indicados según la ruta.
 * @param {Record<string, string>} headers
 * @param {number} status
 */
function startServer(headers, status) {
  return new Promise((resolve) => {
    const server = createServer((_request, response) => {
      response.writeHead(status, headers);
      response.end("ok");
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

describe("evaluateHeaders", () => {
  it("acepta cabeceras completas y x-request-id UUID", () => {
    assert.deepEqual(evaluateHeaders(new Headers(SECURE_HEADERS)), []);
  });

  it("exige Strict-Transport-Security", () => {
    const headers = { ...SECURE_HEADERS };
    delete headers["strict-transport-security"];
    const failures = evaluateHeaders(new Headers(headers));
    assert.ok(failures.some((failure) => failure.includes("strict-transport-security")));
  });

  it("rechaza x-request-id que no es UUID", () => {
    const failures = evaluateHeaders(new Headers({ ...SECURE_HEADERS, "x-request-id": "abc123" }));
    assert.ok(failures.some((failure) => failure.includes("formato UUID")));
  });

  it("exige x-request-id", () => {
    const headers = { ...SECURE_HEADERS };
    delete headers["x-request-id"];
    const failures = evaluateHeaders(new Headers(headers));
    assert.ok(failures.some((failure) => failure.includes("falta la cabecera x-request-id")));
  });

  it("rechaza una CSP vacia", () => {
    const failures = evaluateHeaders(new Headers({ ...SECURE_HEADERS, "content-security-policy": "  " }));
    assert.ok(failures.some((failure) => failure.includes("content-security-policy esta vacia")));
  });
});

describe("resolveCheckUrl", () => {
  it("construye /login sin query ni hash", () => {
    assert.equal(resolveCheckUrl("https://app.example.com/algo?x=1#y").toString(), "https://app.example.com/login");
  });

  it("rechaza URL vacia o de otro protocolo", () => {
    assert.throws(() => resolveCheckUrl(""), /Falta SYNTHETIC_BASE_URL/);
    assert.throws(() => resolveCheckUrl("ftp://example.com"), /http o https/);
  });
});

describe("runCheck contra servidor local", () => {
  /** @type {{ server: import("node:http").Server, base: string } | null} */
  let correct = null;
  /** @type {{ server: import("node:http").Server, base: string } | null} */
  let broken = null;
  /** @type {{ server: import("node:http").Server, base: string } | null} */
  let redirect = null;

  before(async () => {
    correct = await startServer(SECURE_HEADERS, 200);
    const withoutRequestId = Object.fromEntries(
      Object.entries(SECURE_HEADERS).filter(([name]) => name !== "x-request-id"),
    );
    broken = await startServer(withoutRequestId, 200);
    redirect = await startServer(SECURE_HEADERS, 302);
  });

  after(() => {
    for (const handle of [correct, broken, redirect]) {
      handle?.server.close();
    }
  });

  it("supera el check con cabeceras correctas", async () => {
    const url = resolveCheckUrl(correct?.base);
    const result = await runCheck(url);
    assert.equal(result.ok, true, JSON.stringify(result.failures));
    assert.equal(result.status, 200);
  });

  it("falla cuando faltan cabeceras o x-request-id", async () => {
    const url = resolveCheckUrl(broken?.base);
    const result = await runCheck(url);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((failure) => failure.includes("x-request-id")));
  });

  it("falla cuando /login redirige en lugar de devolver 200", async () => {
    const url = resolveCheckUrl(redirect?.base);
    const result = await runCheck(url);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((failure) => failure.includes("estado HTTP 302")));
  });
});
