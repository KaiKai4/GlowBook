import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

function projectPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function runNpmScript(script) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : npmCommand;
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `${npmCommand} run ${script}`]
      : ["run", script];

  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
  });

  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`.trim(),
  };
}

function collectSourceFiles(dir) {
  if (!existsSync(dir)) return [];

  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(fullPath)) && !fullPath.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function findPrivilegedImports() {
  const imports = [];
  const files = collectSourceFiles(path.join(root, "src"));

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (
        line.includes("@/lib/supabase/admin") ||
        line.includes("@/lib/supabase/auth-admin")
      ) {
        imports.push({
          file: projectPath(file),
          line: index + 1,
          text: line.trim(),
        });
      }
    });
  }

  return imports;
}

function latestMigrations(limit = 5) {
  const migrationsDir = path.join(root, "supabase", "migrations");
  if (!existsSync(migrationsDir)) return [];

  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .slice(-limit);
}

function databaseTypesStatus() {
  const typesPath = path.join(root, "src", "types", "database.types.ts");
  const migrationsDir = path.join(root, "supabase", "migrations");

  if (!existsSync(typesPath)) return "missing src/types/database.types.ts";
  if (!existsSync(migrationsDir)) return "missing supabase/migrations";

  const typeStat = statSync(typesPath);
  const migrationStats = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => statSync(path.join(migrationsDir, file)).mtimeMs);

  const latestMigrationTime = Math.max(...migrationStats);
  if (typeStat.mtimeMs < latestMigrationTime) {
    return "review needed: database.types.ts is older than latest migration mtime";
  }

  return "looks current by file mtime";
}

function extractSkipped(testOutput) {
  const testsMatch = testOutput.match(/Tests\s+.*?(\d+)\s+skipped/i);
  const filesMatch = testOutput.match(/Test Files\s+.*?(\d+)\s+skipped/i);

  return {
    tests: testsMatch ? Number(testsMatch[1]) : 0,
    files: filesMatch ? Number(filesMatch[1]) : 0,
  };
}

function printSection(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

console.log("GlowBook Architecture Health");
console.log(new Date().toISOString());

printSection("Architecture Guardrail");
const architecture = runNpmScript("architecture:check");
console.log(architecture.status === 0 ? "[OK] architecture:check passed" : "[FAIL] architecture:check failed");
if (architecture.output) console.log(architecture.output);

printSection("Tests");
const tests = runNpmScript("test");
const skipped = extractSkipped(tests.output);
console.log(tests.status === 0 ? "[OK] test suite passed" : "[FAIL] test suite failed");
console.log(`[INFO] skipped test files: ${skipped.files}`);
console.log(`[INFO] skipped tests: ${skipped.tests}`);

printSection("E2E");
const e2e = runNpmScript("test:e2e");
const e2eSkippedMatch = e2e.output.match(/(\d+)\s+skipped/i);
console.log(e2e.status === 0 ? "[OK] E2E suite passed" : "[FAIL] E2E suite failed");
console.log(`[INFO] skipped E2E tests: ${e2eSkippedMatch ? Number(e2eSkippedMatch[1]) : 0}`);

printSection("Privileged Imports");
const privilegedImports = findPrivilegedImports();
if (privilegedImports.length === 0) {
  console.log("[OK] no privileged imports found");
} else {
  for (const item of privilegedImports) {
    console.log(`[INFO] ${item.file}:${item.line} ${item.text}`);
  }
}

printSection("Current Docs");
const expectedDocs = [
  "docs/README.md",
  "docs/architecture-audit-2026-05-30.md",
  "docs/architecture-audit-phases-2026-05-30.md",
  "docs/database-contracts.md",
  "docs/testing.md",
  "docs/environments.md",
  "docs/production-readiness-checklist.md",
  "docs/security.md",
  "docs/e2e-critical-flows.md",
  "docs/reminders-launch-decision.md",
  "docs/runbooks/deploy.md",
  "docs/runbooks/rollback.md",
  "docs/runbooks/database-restore.md",
  "docs/runbooks/database-migrations.md",
  "docs/runbooks/platform-operations.md",
  "docs/runbooks/load-smoke-5-salons.md",
  "docs/adr/0009-modular-monolith-feature-architecture.md",
  "docs/adr/0010-server-only-admin-adapter-exceptions.md",
];

for (const doc of expectedDocs) {
  console.log(`${existsSync(path.join(root, doc)) ? "[OK]" : "[MISSING]"} ${doc}`);
}

printSection("Recent Migrations");
for (const migration of latestMigrations()) {
  console.log(`[INFO] ${migration}`);
}

printSection("Database Types");
console.log(`[INFO] ${databaseTypesStatus()}`);

console.log("");
console.log("Report only: this script does not fail the build.");
