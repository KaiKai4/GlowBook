import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_DOCS = [
  "docs/archive/architecture-history/architecture-scale-phases-2026-06-01.md",
  "docs/production-scale-readiness-checklist.md",
  "docs/archive/readiness-snapshots/release-scale-readiness-2026-06-01.md",
];

const REQUIRED_DECISION_TEXT = [
  "Decision actual: Go para crecimiento controlado; No-Go para campana nacional",
  "Piloto 5-10 salones: permitido",
  "Crecimiento controlado 25-50 salones: permitido",
  "Lanzamiento amplio 100+ salones/campana nacional: no permitido",
  "Vercel Preview staging ya embebe Supabase staging",
  "Variables De Confirmacion",
  "GLOWBOOK_BASELINE_REQUIRE_SIGNED_DECISION=true",
];

const REQUIRED_CHECKLIST_TEXT = [
  "npm run release:scale-readiness",
  "SCALE_BASELINE_CONFIRMED=true",
  "Fase 46 - Baseline",
  "Go/no-go de lanzamiento amplio firmado",
];

const REQUIRED_PHASE_TEXT = [
  "Fase 46 - Baseline De Release Nacional",
  "Criterio de terminado",
  "Existe un gate separado para lanzamiento amplio",
  "Queda claro que 5 salones y 100+ salones no usan el mismo nivel de evidencia",
];

const REQUIRED_SIGNED_ENVS = [
  "GLOWBOOK_SCALE_DECISION_OWNER",
  "GLOWBOOK_SCALE_DECISION_DATE",
  "GLOWBOOK_SCALE_DECISION_APPROVED_STAGE",
];

function loadEnvFileIfPresent() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=");
  }
}

/** @param {string} message */
function fail(message) {
  console.error(`[baseline-readiness] ${message}`);
  process.exitCode = 1;
}

/** @param {string} message */
function pass(message) {
  console.log(`[baseline-readiness] OK ${message}`);
}

/** @param {string} path */
function readDoc(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** @param {string} name */
function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

/** @param {string} docName @param {string} content @param {string[]} requiredTexts */
function requireText(docName, content, requiredTexts) {
  for (const text of requiredTexts) {
    if (content.includes(text)) {
      pass(`${docName} contains: ${text}`);
    } else {
      fail(`${docName} missing: ${text}`);
    }
  }
}

loadEnvFileIfPresent();

for (const doc of REQUIRED_DOCS) {
  if (existsSync(join(process.cwd(), doc))) {
    pass(`${doc} exists`);
  } else {
    fail(`${doc} is missing`);
  }
}

const decisionDoc = existsSync(join(process.cwd(), "docs/archive/readiness-snapshots/release-scale-readiness-2026-06-01.md"))
  ? readDoc("docs/archive/readiness-snapshots/release-scale-readiness-2026-06-01.md")
  : "";
const checklist = existsSync(join(process.cwd(), "docs/production-scale-readiness-checklist.md"))
  ? readDoc("docs/production-scale-readiness-checklist.md")
  : "";
const phases = existsSync(join(process.cwd(), "docs/archive/architecture-history/architecture-scale-phases-2026-06-01.md"))
  ? readDoc("docs/archive/architecture-history/architecture-scale-phases-2026-06-01.md")
  : "";

requireText("release scale decision", decisionDoc, REQUIRED_DECISION_TEXT);
requireText("scale checklist", checklist, REQUIRED_CHECKLIST_TEXT);
requireText("scale phases", phases, REQUIRED_PHASE_TEXT);

if (process.env.GLOWBOOK_BASELINE_REQUIRE_SIGNED_DECISION === "true") {
  for (const name of REQUIRED_SIGNED_ENVS) {
    if (hasEnv(name)) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is required when GLOWBOOK_BASELINE_REQUIRE_SIGNED_DECISION=true`);
    }
  }
} else {
  pass("signed go/no-go is optional until broad launch confirmation");
}

if (process.exitCode) {
  console.log("[baseline-readiness] Baseline readiness failed.");
  process.exit(process.exitCode);
}

console.log("[baseline-readiness] Baseline readiness passed.");
