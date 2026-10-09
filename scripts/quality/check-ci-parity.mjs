// Paridad entre CI (.github/workflows) y el manifiesto de pasos (steps.mjs).
//   (a) cada job de STEPS aparece en algún job de CI que ejecuta
//       "npm run verify:job -- <job>" o "node scripts/quality/verify.mjs --job <job>".
//   (b) ningún job de CI ejecuta herramientas de calidad sueltas fuera del runner.
//   (c) existe un job CodeQL (solo CI, documentado en docs/ del runner).
// El parseo de YAML es por texto (sin dependencias): solo se leen claves "jobs",
// ids de job con dos espacios de sangría, "run:" (línea o bloque |/>) y "uses:".
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./lib-process.mjs";
import { STEPS } from "./steps.mjs";

const WORKFLOWS_DIR = join(ROOT, ".github", "workflows");

const LOOSE_TOOL_PATTERNS = [
  /(?:^|[\s&|;(])(eslint|tsc|vitest|playwright|knip|depcruise|dependency-cruiser|lhci|squawk|secretlint)(?=\s|$)/,
  /(?:^|[\s&|;(])next\s+build(?=\s|$)/,
  /npm\s+run\s+(?:lint|type-check|test(?::[\w:-]+)?|build|architecture[\w:-]*)(?=\s|$)/,
];
const ALLOWED_LOOSE_LINES = [/verify/, /playwright\s+install/];

/**
 * Ids de job y comandos "run" de un workflow, sin depender de un parser YAML.
 * @param {string} text
 * @returns {{ jobs: Map<string, string[]>, uses: string[] }}
 */
export function parseWorkflow(text) {
  /** @type {Map<string, string[]>} */
  const jobs = new Map();
  /** @type {string[]} */
  const usesLines = [];
  const lines = text.split(/\r?\n/);
  let inJobs = false;
  /** @type {string | null} */
  let currentJob = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (/^\S/.test(line)) {
      inJobs = trimmed === "jobs:";
      currentJob = null;
      continue;
    }
    if (!inJobs) continue;

    const jobMatch = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobMatch) {
      currentJob = jobMatch[1];
      if (!jobs.has(currentJob)) jobs.set(currentJob, []);
      continue;
    }
    if (currentJob === null) continue;

    const usesMatch = /uses:\s*(\S+)/.exec(line);
    if (usesMatch) usesLines.push(usesMatch[1]);

    const runMatch = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(line);
    if (!runMatch) continue;
    const keyColumn = line.indexOf("run:");
    const value = runMatch[2].trim();
    if (value === "|" || value === ">" || value === "|-" || value === ">-") {
      /** @type {string[]} */
      const block = [];
      let next = index + 1;
      while (next < lines.length) {
        const candidate = lines[next];
        if (candidate.trim() !== "" && candidate.search(/\S/) <= keyColumn) break;
        if (candidate.trim() !== "") block.push(candidate.trim());
        next += 1;
      }
      index = next - 1;
      jobs.get(currentJob)?.push(...block);
    } else if (value !== "") {
      jobs.get(currentJob)?.push(value);
    }
  }

  return { jobs, uses: usesLines };
}

/**
 * Comando que delega un job en el runner de calidad.
 * @param {string} command
 * @param {string} job
 * @returns {boolean}
 */
export function runsVerifyJob(command, job) {
  const tokens = command.trim().split(/\s+/);
  return tokens.some((token, index) =>
    (token === "verify:job" && tokens[index + 1] === "--" && tokens[index + 2] === job) ||
    (token.endsWith("verify.mjs") && tokens[index + 1] === "--job" && tokens[index + 2] === job),
  );
}

/**
 * Herramienta de calidad usada directamente en CI (fuera del runner).
 * @param {string} command
 * @returns {string | null}
 */
export function findLooseToolCommand(command) {
  if (ALLOWED_LOOSE_LINES.some((pattern) => pattern.test(command))) return null;
  return LOOSE_TOOL_PATTERNS.some((pattern) => pattern.test(command)) ? command : null;
}

/**
 * Comprueba la paridad. `workflows` = [{ name, text }].
 * Devuelve la lista de errores (vacía si todo está en orden).
 * @param {{ steps: ReadonlyArray<{ jobs: string[] }>, workflows: { name: string, text: string }[] }} input
 * @returns {string[]}
 */
export function checkCiParity({ steps, workflows }) {
  /** @type {string[]} */
  const errors = [];
  const parsed = workflows.map((workflow) => ({ name: workflow.name, ...parseWorkflow(workflow.text) }));
  const requiredJobs = [...new Set(steps.flatMap((step) => step.jobs))];

  for (const job of requiredJobs) {
    const delegated = parsed.some((workflow) =>
      [...workflow.jobs.entries()].some(([, commands]) =>
        commands.some((command) => runsVerifyJob(command, job))
      )
    );
    if (!delegated) {
      errors.push(
        `[a] el job "${job}" de STEPS no aparece en ningún job de CI que ejecute "npm run verify:job -- ${job}".`
      );
    }
  }

  for (const workflow of parsed) {
    for (const [jobId, commands] of workflow.jobs) {
      for (const command of commands) {
        const loose = findLooseToolCommand(command);
        if (loose) {
          errors.push(
            `[b] ${workflow.name} job "${jobId}" ejecuta una herramienta de calidad fuera del runner: "${loose}".`
          );
        }
      }
    }
  }

  const hasCodeql = parsed.some(
    (workflow) =>
      workflow.jobs.has("codeql") || workflow.uses.some((uses) => uses.startsWith("github/codeql-action"))
  );
  if (!hasCodeql) {
    errors.push("[c] falta un job CodeQL en .github/workflows (CI-only, no se ejecuta en local).");
  }

  return errors;
}

/** @returns {{ name: string, text: string }[]} */
function readWorkflows() {
  if (!existsSync(WORKFLOWS_DIR)) return [];
  return readdirSync(WORKFLOWS_DIR)
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .map((file) => ({ name: file, text: readFileSync(join(WORKFLOWS_DIR, file), "utf8") }));
}

/** @returns {void} */
function main() {
  const errors = checkCiParity({ steps: STEPS, workflows: readWorkflows() });
  if (errors.length > 0) {
    for (const error of errors) console.error(`[ci-parity] ${error}`);
    console.error(`[ci-parity] FALLO: ${errors.length} discrepancia(s).`);
    process.exit(1);
  }
  console.log("[ci-parity] CI y manifiesto de pasos coinciden.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
