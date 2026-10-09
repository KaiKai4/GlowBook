// Tests de la lógica pura del gate de release.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REQUIRED_SECRETS,
  RELEASE_JOB_NAMES,
  evaluateCheckRuns,
  findMissingSecrets,
  isValidSha,
  parseCheckRunsResponse,
} from "./gate-logic.mjs";

/** @returns {Record<string, string>} */
function fullEnv() {
  return Object.fromEntries(REQUIRED_SECRETS.map((name) => [name, `valor-${name}`]));
}

describe("findMissingSecrets", () => {
  it("no reporta nada cuando todos los secretos existen", () => {
    assert.deepEqual(findMissingSecrets(fullEnv()), []);
  });

  it("reporta ausentes y vacíos por nombre, sin valores", () => {
    const env = fullEnv();
    delete env.VERCEL_TOKEN;
    env.ALERT_WEBHOOK_URL = "   ";
    const missing = findMissingSecrets(env);
    assert.deepEqual(missing, ["VERCEL_TOKEN", "ALERT_WEBHOOK_URL"]);
  });

  it("incluye todos los secretos requeridos del contrato", () => {
    for (const name of [
      "VERCEL_TOKEN",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      "SUPABASE_ACCESS_TOKEN",
      "PRODUCTION_DB_URL",
      "PRODUCTION_SUPABASE_URL",
      "PRODUCTION_PROJECT_REF",
      "SYNTHETIC_BASE_URL",
      "ALERT_WEBHOOK_URL",
    ]) {
      assert.ok(REQUIRED_SECRETS.includes(name), `falta ${name}`);
    }
  });
});

describe("isValidSha", () => {
  it("acepta solo 40 hex en minúsculas", () => {
    assert.equal(isValidSha("a".repeat(40)), true);
    assert.equal(isValidSha("A".repeat(40)), false);
    assert.equal(isValidSha("a".repeat(39)), false);
    assert.equal(isValidSha(undefined), false);
  });
});

describe("parseCheckRunsResponse", () => {
  it("normaliza check-runs válidos", () => {
    const page = parseCheckRunsResponse({
      total_count: 1,
      check_runs: [{ id: 7, name: "Static", status: "completed", conclusion: "success", extra: 1 }],
    });
    assert.deepEqual(page, {
      totalCount: 1,
      checkRuns: [{ id: 7, name: "Static", status: "completed", conclusion: "success" }],
    });
  });

  it("lanza si la forma no es la esperada", () => {
    assert.throws(() => parseCheckRunsResponse(null));
    assert.throws(() => parseCheckRunsResponse({ total_count: "1", check_runs: [] }));
    assert.throws(() => parseCheckRunsResponse({ total_count: 1, check_runs: [{ id: "x" }] }));
  });
});

describe("evaluateCheckRuns", () => {
  /**
   * @param {number} id
   * @param {string} name
   * @returns {{ id: number, name: string, status: string, conclusion: string | null }}
   */
  const ok = (id, name) => ({ id, name, status: "completed", conclusion: "success" });

  it("pasa cuando todos los check-runs de CI están en success", () => {
    const result = evaluateCheckRuns({ totalCount: 2, checkRuns: [ok(1, "Static"), ok(2, "Unit tests")] });
    assert.equal(result.ok, true);
    assert.equal(result.evaluated, 2);
  });

  it("falla si no hay ningún check-run de CI", () => {
    const result = evaluateCheckRuns({ totalCount: 0, checkRuns: [] });
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /no hay check-runs/);
  });

  it("falla si un check-run está en failure, neutral o cancelled", () => {
    for (const conclusion of ["failure", "neutral", "cancelled"]) {
      const result = evaluateCheckRuns({
        totalCount: 1,
        checkRuns: [{ id: 1, name: "Browser", status: "completed", conclusion }],
      });
      assert.equal(result.ok, false, conclusion);
    }
  });

  it("falla si un check-run sigue en progreso", () => {
    const result = evaluateCheckRuns({
      totalCount: 1,
      checkRuns: [{ id: 1, name: "Lighthouse", status: "in_progress", conclusion: null }],
    });
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /in_progress/);
  });

  it("usa la ejecución más reciente por nombre (re-run)", () => {
    const result = evaluateCheckRuns({
      totalCount: 2,
      checkRuns: [
        { id: 10, name: "Static", status: "completed", conclusion: "failure" },
        ok(20, "Static"),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.evaluated, 1);
  });

  it("ignora los check-runs de los propios jobs de release", () => {
    const result = evaluateCheckRuns({
      totalCount: 2,
      checkRuns: [ok(1, "Static"), { id: 2, name: "Release gate", status: "in_progress", conclusion: null }],
    });
    assert.equal(result.ok, true);
    assert.ok(RELEASE_JOB_NAMES.includes("Release gate"));
  });

  it("falla si la paginación es incompleta", () => {
    const result = evaluateCheckRuns({ totalCount: 150, checkRuns: [ok(1, "Static")] });
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /paginación incompleta/);
  });
});
