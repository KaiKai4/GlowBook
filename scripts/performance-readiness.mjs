import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PERFORMANCE_DOC = "docs/performance-review-2026-06-01.md";

const REQUIRED_TEXT = [
  "Batch: scale-20260601-100",
  "Supabase performance advisors",
  "No issues found",
  "No crear indices nuevos por ahora",
  "Falta revisar Vercel Logs",
  "scale:measure-routes",
  "Detected deployed host(s): eokiklkgutzrkhbamglf.supabase.co",
];

const CRITICAL_ROUTES = [
  "/",
  "/appointments",
  "/appointments/new",
  "/customers",
  "/employees",
  "/services",
  "/reports",
  "/admin",
  "/admin/salons",
  "/admin/audit",
];

function fail(message) {
  console.error(`[performance-readiness] ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[performance-readiness] OK ${message}`);
}

function readDoc(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

if (!existsSync(join(process.cwd(), PERFORMANCE_DOC))) {
  fail(`${PERFORMANCE_DOC} is missing`);
} else {
  pass(`${PERFORMANCE_DOC} exists`);
}

if (!existsSync(join(process.cwd(), "scripts/measure-scale-routes.mjs"))) {
  fail("scripts/measure-scale-routes.mjs is missing");
} else {
  pass("scripts/measure-scale-routes.mjs exists");
}

const doc = existsSync(join(process.cwd(), PERFORMANCE_DOC)) ? readDoc(PERFORMANCE_DOC) : "";

for (const text of REQUIRED_TEXT) {
  if (doc.includes(text)) {
    pass(`performance evidence present: ${text}`);
  } else {
    fail(`performance evidence missing: ${text}`);
  }
}

for (const route of CRITICAL_ROUTES) {
  if (doc.includes(`| \`${route}\` |`)) {
    pass(`critical route tracked: ${route}`);
  } else {
    fail(`critical route missing from performance table: ${route}`);
  }
}

if (process.env.GLOWBOOK_PERFORMANCE_REQUIRE_ROUTE_MEASUREMENTS === "true") {
  if (doc.includes("| pendiente | pendiente |")) {
    fail("route measurements are still pending but GLOWBOOK_PERFORMANCE_REQUIRE_ROUTE_MEASUREMENTS=true");
  } else {
    pass("route measurements are completed");
  }
} else {
  pass("route measurements are optional until deployed staging is corrected");
}

if (process.exitCode) {
  console.log("[performance-readiness] Performance readiness failed.");
  process.exit(process.exitCode);
}

console.log("[performance-readiness] Performance readiness passed.");
