import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_DOCS = [
  "docs/runbooks/restore.md",
  "docs/production-scale-readiness-checklist.md",
];

const REQUIRED_RESTORE_EVIDENCE = [
  "Restore De Prueba Ejecutado 2026-05-31 / 2026-06-01 UTC",
  "Batch usado: `smoke-restore-20260531`",
  "`smoke_salons=5`",
  "`smoke_customers=500`",
  "`smoke_employees=30`",
  "`smoke_appointments=400`",
  "`smoke_auth_users=5`",
  "Restore Grande Ejecutado 2026-06-01 UTC",
  "Batch usado: `scale-restore-20260601-100`",
  "`scale_salons=100`",
  "`scale_customers=15000`",
  "`scale_employees=800`",
  "`scale_appointments=12000`",
  "`scale_auth_users=100`",
  "100 salones eliminados",
  "100 auth users eliminados",
];

/** @param {string} path @returns {string} */
function readDoc(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** @param {string} message @returns {void} */
function fail(message) {
  console.error(`[restore-readiness] ${message}`);
  process.exitCode = 1;
}

/** @param {string} message @returns {void} */
function pass(message) {
  console.log(`[restore-readiness] OK ${message}`);
}

for (const doc of REQUIRED_DOCS) {
  if (existsSync(join(process.cwd(), doc))) {
    pass(`${doc} exists`);
  } else {
    fail(`${doc} is missing`);
  }
}

const restoreDoc = existsSync(join(process.cwd(), "docs/runbooks/restore.md"))
  ? readDoc("docs/runbooks/restore.md")
  : "";

for (const text of REQUIRED_RESTORE_EVIDENCE) {
  if (restoreDoc.includes(text)) {
    pass(`restore evidence present: ${text}`);
  } else {
    fail(`restore evidence missing: ${text}`);
  }
}

if (restoreDoc.includes("RTO objetivo:") && restoreDoc.includes("RPO objetivo:")) {
  pass("RTO/RPO template exists");
} else {
  fail("RTO/RPO template is missing");
}

if (process.env.GLOWBOOK_RESTORE_REQUIRE_BUSINESS_RTO_RPO === "true") {
  for (const name of ["GLOWBOOK_RESTORE_RTO", "GLOWBOOK_RESTORE_RPO", "GLOWBOOK_RESTORE_OWNER"]) {
    if (process.env[name]?.trim()) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is required when GLOWBOOK_RESTORE_REQUIRE_BUSINESS_RTO_RPO=true`);
    }
  }
} else {
  pass("business RTO/RPO values are optional until broad launch confirmation");
}

if (process.exitCode) {
  console.log("[restore-readiness] Restore readiness failed.");
  process.exit(process.exitCode);
}

console.log("[restore-readiness] Restore readiness passed.");
