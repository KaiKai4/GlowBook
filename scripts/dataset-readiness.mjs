import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_DOCS = [
  "docs/runbooks/load-scale-salons.md",
  "docs/production-scale-readiness-checklist.md",
  "docs/performance-review-2026-06-01.md",
];

const REQUIRED_SCRIPTS = [
  "scripts/seed-staging-scale.mjs",
  "scripts/cleanup-staging-scale.mjs",
  "scripts/measure-scale-routes.mjs",
];

const REQUIRED_EVIDENCE = [
  "Dataset de 25 salones creado y limpiado",
  "Dataset de 50 salones creado y limpiado",
  "Dataset de 100 salones creado y limpiado",
  "scale-20260601-25",
  "scale-20260601-50",
  "scale-20260601-100",
  "100 salones",
  "15000 clientes",
  "12000 citas",
  "cleanup",
];

/** @param {string} path @returns {string} */
function readDoc(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** @param {string} message @returns {void} */
function fail(message) {
  console.error(`[dataset-readiness] ${message}`);
  process.exitCode = 1;
}

/** @param {string} message @returns {void} */
function pass(message) {
  console.log(`[dataset-readiness] OK ${message}`);
}

for (const doc of REQUIRED_DOCS) {
  if (existsSync(join(process.cwd(), doc))) {
    pass(`${doc} exists`);
  } else {
    fail(`${doc} is missing`);
  }
}

for (const script of REQUIRED_SCRIPTS) {
  if (existsSync(join(process.cwd(), script))) {
    pass(`${script} exists`);
  } else {
    fail(`${script} is missing`);
  }
}

const checklist = existsSync(join(process.cwd(), "docs/production-scale-readiness-checklist.md"))
  ? readDoc("docs/production-scale-readiness-checklist.md")
  : "";
const performance = existsSync(join(process.cwd(), "docs/performance-review-2026-06-01.md"))
  ? readDoc("docs/performance-review-2026-06-01.md")
  : "";
const combined = `${checklist}\n${performance}`;

for (const evidence of REQUIRED_EVIDENCE) {
  if (combined.includes(evidence)) {
    pass(`scale dataset evidence present: ${evidence}`);
  } else {
    fail(`scale dataset evidence missing: ${evidence}`);
  }
}

if (process.exitCode) {
  console.log("[dataset-readiness] Dataset readiness failed.");
  process.exit(process.exitCode);
}

console.log("[dataset-readiness] Dataset readiness passed.");
