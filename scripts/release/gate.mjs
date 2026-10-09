// Gate de release: secretos requeridos, SHA de main y check-runs en success.
// Uso (CI): TARGET_SHA=<sha> GITHUB_REPOSITORY=owner/repo GH_TOKEN=... node scripts/release/gate.mjs
// Nunca imprime valores de secretos. Sale con código 1 ante cualquier fallo.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  RELEASE_JOB_NAMES,
  REQUIRED_SECRETS,
  evaluateCheckRuns,
  findMissingSecrets,
  isValidSha,
  parseCheckRunsResponse,
} from "./gate-logic.mjs";

/**
 * Comprueba que el SHA es alcanzable desde origin/main (requiere fetch-depth 0).
 * @param {string} sha
 * @returns {{ ok: boolean, detail: string }}
 */
export function checkAncestorOfMain(sha) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", sha, "origin/main"], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status === 0) return { ok: true, detail: "el SHA pertenece a main" };
  return { ok: false, detail: "el SHA no es alcanzable desde origin/main (o falta fetch-depth: 0)" };
}

/**
 * Lee los check-runs del commit con gh api.
 * @param {string} repo owner/name
 * @param {string} sha
 * @returns {unknown}
 */
export function fetchCheckRuns(repo, sha) {
  const result = spawnSync(
    "gh",
    ["api", `repos/${repo}/commits/${sha}/check-runs?per_page=100&filter=latest`],
    { encoding: "utf8", shell: false }
  );
  if (result.status !== 0) {
    throw new Error(`gh api no devolvió check-runs (código ${result.status ?? "desconocido"})`);
  }
  return JSON.parse(result.stdout);
}

/** @returns {void} */
function main() {
  /** @type {string[]} */
  const errors = [];

  const missing = findMissingSecrets(process.env, REQUIRED_SECRETS);
  if (missing.length > 0) {
    errors.push(`faltan secretos requeridos: ${missing.join(", ")}`);
  }

  const sha = process.env.TARGET_SHA ?? "";
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  if (!isValidSha(sha)) {
    errors.push("TARGET_SHA no es un SHA completo de 40 caracteres");
  }
  if (repo === "") {
    errors.push("falta GITHUB_REPOSITORY");
  }

  if (errors.length === 0) {
    const ancestor = checkAncestorOfMain(sha);
    if (!ancestor.ok) errors.push(ancestor.detail);

    try {
      const page = parseCheckRunsResponse(fetchCheckRuns(repo, sha));
      const evaluation = evaluateCheckRuns(page, RELEASE_JOB_NAMES);
      console.log(`[gate] check-runs de CI evaluados: ${evaluation.evaluated}`);
      errors.push(...evaluation.failures);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "error desconocido leyendo check-runs");
    }
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`[gate] FALLO: ${error}`);
    console.error("[gate] La release no puede continuar.");
    process.exit(1);
  }
  console.log(`[gate] OK: ${sha} en main, secretos presentes y check-runs en success.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
