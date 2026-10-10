// Tests de la lógica pura de alertas del check sintético.
// Ejecución: node --test scripts/ops/synthetic-alert.test.mjs

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAlertPayload,
  buildIssueBody,
  buildIssueTitle,
  decideSyntheticAction,
  isSyntheticIssueTitle,
  missingResult,
  parseSyntheticResult,
  parseSyntheticTarget,
} from "./synthetic-alert.mjs";

import { postWebhook } from "./synthetic-alert-cli.mjs";

it("sin webhook conserva los avisos de GitHub sin intentar un POST", async () => {
  const payload = buildAlertPayload({ target: "production", result: missingResult(), runUrl: "", commit: "", occurredAt: "2026-10-09" });
  await postWebhook("", payload, async () => { throw new Error("POST inesperado"); });
});

const failingResult = {
  ok: false,
  failures: ["estado HTTP 500 (se esperaba 200)", "falta la cabecera x-request-id"],
  status: 500,
  elapsedMs: 120,
};

const passingResult = { ok: true, failures: [], status: 200, elapsedMs: 210 };

describe("decideSyntheticAction", () => {
  it("abre issue y alerta en fallo sin issue previo", () => {
    assert.deepEqual(decideSyntheticAction({ result: failingResult, openIssueNumber: null }), {
      alert: true,
      issue: "open",
    });
  });

  it("comenta en el issue existente cuando sigue fallando", () => {
    assert.deepEqual(decideSyntheticAction({ result: failingResult, openIssueNumber: 7 }), {
      alert: true,
      issue: "comment",
    });
  });

  it("no alerta si todo va bien y no hay issue", () => {
    assert.deepEqual(decideSyntheticAction({ result: passingResult, openIssueNumber: null }), {
      alert: false,
      issue: "none",
    });
  });

  it("cierra el issue al recuperarse sin alertar", () => {
    assert.deepEqual(decideSyntheticAction({ result: passingResult, openIssueNumber: 7 }), {
      alert: false,
      issue: "close",
    });
  });

  it("trata un resultado ausente como fallo", () => {
    assert.equal(decideSyntheticAction({ result: missingResult(), openIssueNumber: null }).alert, true);
  });
});

describe("buildAlertPayload", () => {
  const base = {
    target: /** @type {const} */ ("production"),
    commit: "0123456789abcdef0123456789abcdef01234567",
    runUrl: "https://github.com/acme/glowbook/actions/runs/1",
    occurredAt: "2026-10-09T10:00:00.000Z",
  };

  it("incluye solo campos esperados y acorta el commit", () => {
    const payload = buildAlertPayload({ ...base, result: failingResult });
    assert.deepEqual(Object.keys(payload).sort(), [
      "checkPath", "commit", "elapsedMs", "event", "failures", "occurredAt", "runUrl", "status", "target",
    ]);
    assert.equal(payload.commit, "0123456");
    assert.equal(payload.checkPath, "/login");
    assert.equal(payload.event, "glowbook.synthetic_failure");
  });

  it("no filtra URLs ni cabeceras con valores", () => {
    const leaky = {
      ok: false,
      failures: ["fallo al llamar https://secret.example.com/path?token=abc"],
      status: null,
      elapsedMs: null,
    };
    const serialized = JSON.stringify(buildAlertPayload({ ...base, result: leaky }));
    assert.doesNotMatch(serialized, /secret\.example\.com/);
    assert.doesNotMatch(serialized, /token=abc/);
    assert.ok(serialized.includes("[url]"));
  });

  it("marca el commit como desconocido si no es un hash valido", () => {
    const payload = buildAlertPayload({ ...base, commit: "; rm -rf", result: failingResult });
    assert.equal(payload.commit, "desconocido");
  });
});

describe("sanitización de fallos (vía buildAlertPayload)", () => {
  /** @param {string} failure */
  const sanitizedFailure = (failure) =>
    buildAlertPayload({
      target: "production",
      result: { ...failingResult, failures: [failure] },
      runUrl: "https://github.com/acme/glowbook/actions/runs/1",
      commit: "abcdef1234567",
      occurredAt: "2026-10-09T00:00:00Z",
    }).failures[0];

  it("limita la longitud del texto", () => {
    assert.equal(sanitizedFailure("a".repeat(1000)).length, 300);
  });

  it("colapsa espacios", () => {
    assert.equal(sanitizedFailure("  uno \n\t dos  "), "uno dos");
  });
});

describe("parseSyntheticResult", () => {
  it("acepta un resultado coherente", () => {
    assert.deepEqual(parseSyntheticResult(failingResult), failingResult);
  });

  it("rechaza ok inconsistente con los fallos", () => {
    assert.throws(() => parseSyntheticResult({ ...failingResult, ok: true }), /no coincide/);
  });

  it("rechaza valores que no son objeto", () => {
    assert.throws(() => parseSyntheticResult("texto"), /no es un objeto/);
    assert.throws(() => parseSyntheticResult(null), /no es un objeto/);
  });

  it("rechaza listas de fallos con valores no textuales", () => {
    assert.throws(() => parseSyntheticResult({ ok: false, failures: [1], status: 200, elapsedMs: 1 }), /no son texto/);
  });
});

describe("parseSyntheticTarget", () => {
  it("acepta production y staging", () => {
    assert.equal(parseSyntheticTarget("production"), "production");
    assert.equal(parseSyntheticTarget("staging"), "staging");
  });

  it("rechaza otros destinos", () => {
    assert.throws(() => parseSyntheticTarget("local"), /SYNTHETIC_TARGET/);
    assert.throws(() => parseSyntheticTarget(undefined), /SYNTHETIC_TARGET/);
  });
});

describe("titulos de issue", () => {
  it("identifica issues del mismo target", () => {
    const title = buildIssueTitle("staging");
    assert.equal(isSyntheticIssueTitle(title, "staging"), true);
    assert.equal(isSyntheticIssueTitle(title, "production"), false);
  });

  it("el cuerpo incluye los fallos y el enlace de ejecucion", () => {
    const payload = buildAlertPayload({
      target: "staging",
      result: failingResult,
      runUrl: "https://github.com/acme/glowbook/actions/runs/9",
      commit: "abcdef1",
      occurredAt: "2026-10-09T10:00:00.000Z",
    });
    const body = buildIssueBody(payload);
    assert.ok(body.includes("falta la cabecera x-request-id"));
    assert.ok(body.includes("actions/runs/9"));
  });
});
