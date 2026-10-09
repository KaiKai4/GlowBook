// Tests del payload de alerta y del envío (fetch inyectado).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAlertPayload, sanitizeHttpsUrl, sendAlert } from "./alert.mjs";

const SHA = "b".repeat(40);
const WEBHOOK = "https://hooks.example.com/services/T000/SECRETO123";

describe("sanitizeHttpsUrl", () => {
  it("quita query y hash y rechaza http o URLs rotas", () => {
    assert.equal(sanitizeHttpsUrl("https://app.example.com/login?token=abc#x"), "https://app.example.com/login");
    assert.equal(sanitizeHttpsUrl("http://app.example.com"), null);
    assert.equal(sanitizeHttpsUrl("no es url"), null);
    assert.equal(sanitizeHttpsUrl(null), null);
  });
});

describe("buildAlertPayload", () => {
  it("construye un payload con sha, etapa y URLs saneadas", () => {
    const payload = buildAlertPayload({
      stage: "promote",
      sha: SHA,
      deploymentUrl: "https://glowbook-abc.vercel.app/?bypass=1",
      runUrl: "https://github.com/org/repo/actions/runs/1",
      rollbackAttempted: true,
      occurredAt: new Date("2026-10-09T10:00:00.000Z"),
    });
    assert.equal(payload.event, "glowbook.release.failed");
    assert.equal(payload.stage, "promote");
    assert.equal(payload.sha, SHA);
    assert.equal(payload.deploymentUrl, "https://glowbook-abc.vercel.app/");
    assert.equal(payload.rollbackAttempted, true);
    assert.equal(payload.occurredAt, "2026-10-09T10:00:00.000Z");
  });

  it("no contiene secretos aunque se pasen en las URLs", () => {
    const payload = buildAlertPayload({
      stage: "smoke-production",
      sha: SHA,
      deploymentUrl: "https://app.example.com/?x-vercel-protection-bypass=SECRETO",
    });
    assert.equal(JSON.stringify(payload).includes("SECRETO"), false);
    assert.equal(JSON.stringify(payload).includes(WEBHOOK), false);
  });

  it("rechaza etapas desconocidas y SHA no válidos", () => {
    assert.throws(() => buildAlertPayload({ stage: "otra", sha: SHA }));
    assert.throws(() => buildAlertPayload({ stage: "gate", sha: "corto" }));
  });
});

describe("sendAlert", () => {
  it("envía POST JSON al webhook y devuelve el estado", async () => {
    /** @type {{ url: string, init: RequestInit | undefined }[]} */
    const calls = [];
    const fakeFetch = /** @type {typeof fetch} */ (async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    });
    const payload = buildAlertPayload({ stage: "gate", sha: SHA });
    const result = await sendAlert(WEBHOOK, payload, fakeFetch);
    assert.deepEqual(result, { ok: true, status: 204 });
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(JSON.parse(String(calls[0].init?.body)).stage, "gate");
  });

  it("devuelve ok false si el webhook responde con error o no responde", async () => {
    const failing = /** @type {typeof fetch} */ (async () => new Response(null, { status: 500 }));
    const broken = /** @type {typeof fetch} */ (async () => {
      throw new TypeError("red caída");
    });
    const payload = buildAlertPayload({ stage: "gate", sha: SHA });
    assert.equal((await sendAlert(WEBHOOK, payload, failing)).ok, false);
    assert.deepEqual(await sendAlert(WEBHOOK, payload, broken), { ok: false, status: null });
  });

  it("rechaza webhooks que no son https", async () => {
    const payload = buildAlertPayload({ stage: "gate", sha: SHA });
    await assert.rejects(() => sendAlert("http://insegura.example.com", payload));
  });
});
