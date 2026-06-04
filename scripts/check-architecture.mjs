import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const allowedAdminClientImporters = new Set([
  "src/features/employees/data/employee-access.repo.ts",
  "src/features/platform/data/delete-salon.repo.ts",
  "src/features/platform/data/feedback-moderation.repo.ts",
  "src/features/platform/data/invitations.repo.ts",
  "src/features/platform/data/platform-audit.repo.ts",
  "src/features/platform/data/salon-overviews.repo.ts",
  "src/features/platform/data/salons.repo.ts",
  "src/lib/auth/session.ts",
  "src/lib/supabase/auth-admin.ts",
]);

const allowedAuthAdminImporters = new Set([
  "src/features/employees/data/employee-auth.repo.ts",
  "src/features/platform/data/delete-salon.repo.ts",
  "src/features/platform/data/platform-auth.repo.ts",
]);

const importPatterns = [
  /import\s+(?:type\s+)?[^'"]*?\s+from\s*["']([^"']+)["']/g,
  /import\s*["']([^"']+)["']/g,
  /export\s+(?:type\s+)?[^'"]*?\s+from\s*["']([^"']+)["']/g,
];

function toProjectPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function isInside(projectPath, dir) {
  return projectPath === dir || projectPath.startsWith(`${dir}/`);
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith("@/")) {
    return toProjectPath(path.join(srcRoot, specifier.slice(2)));
  }

  if (specifier.startsWith(".")) {
    return toProjectPath(path.resolve(path.dirname(fromFile), specifier));
  }

  return null;
}

function collectSourceFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
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

function collectDirectories(dir) {
  const entries = readdirSync(dir);
  const directories = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (!stat.isDirectory()) continue;

    directories.push(fullPath);
    directories.push(...collectDirectories(fullPath));
  }

  return directories;
}

function collectImports(source) {
  const imports = [];

  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function isFeatureDomain(projectPath) {
  return /^src\/features\/[^/]+\/domain(\/|$)/.test(projectPath);
}

function isFeatureUseCase(projectPath) {
  return /^src\/features\/[^/]+\/use-cases(\/|$)/.test(projectPath);
}

function isTestSource(projectPath) {
  return /\.(test|spec)\.[jt]sx?$/.test(projectPath);
}

function featureName(projectPath) {
  const match = projectPath.match(/^src\/features\/([^/]+)\//);
  return match?.[1] ?? null;
}

function isFeatureData(projectPath) {
  return /^src\/features\/[^/]+\/data(\/|$)/.test(projectPath);
}

function isForbiddenDomainImport(specifier, resolvedPath) {
  if (specifier === "react" || specifier.startsWith("react/")) return true;
  if (specifier === "next" || specifier.startsWith("next/")) return true;
  if (specifier === "server-only") return true;
  if (specifier.startsWith("@supabase/")) return true;
  if (specifier === "@/lib/supabase" || specifier.startsWith("@/lib/supabase/")) return true;
  if (resolvedPath && isInside(resolvedPath, "src/lib/supabase")) return true;

  return false;
}

function isSupabaseLibImport(specifier, resolvedPath) {
  return (
    specifier === "@/lib/supabase" ||
    specifier.startsWith("@/lib/supabase/") ||
    (resolvedPath && isInside(resolvedPath, "src/lib/supabase"))
  );
}

function isSupabaseAdminImport(specifier, resolvedPath) {
  return specifier === "@/lib/supabase/admin" || resolvedPath === "src/lib/supabase/admin";
}

function isSupabaseAuthAdminImport(specifier, resolvedPath) {
  return (
    specifier === "@/lib/supabase/auth-admin" ||
    resolvedPath === "src/lib/supabase/auth-admin"
  );
}

const violations = [];
const warnings = [];

for (const directory of collectDirectories(path.join(srcRoot, "features"))) {
  const entries = readdirSync(directory);
  if (entries.length === 0) {
    violations.push({
      file: toProjectPath(directory),
      import: "(empty directory)",
      rule: "feature directories must contain a real Module or a README explaining the reserved Seam",
    });
  }
}

for (const file of collectSourceFiles(srcRoot)) {
  const projectPath = toProjectPath(file);
  const source = readFileSync(file, "utf8");
  const imports = collectImports(source);

  for (const specifier of imports) {
    const resolvedPath = resolveImport(file, specifier);

    if (
      isInside(projectPath, "src/components") &&
      (specifier === "@/app" ||
        specifier.startsWith("@/app/") ||
        (resolvedPath && isInside(resolvedPath, "src/app")))
    ) {
      violations.push({
        file: projectPath,
        import: specifier,
        rule: "components must not import app routes or actions",
      });
    }

    if (isFeatureDomain(projectPath) && isForbiddenDomainImport(specifier, resolvedPath)) {
      violations.push({
        file: projectPath,
        import: specifier,
        rule: "features/*/domain must stay pure: no Supabase, Next, React or server-only",
      });
    }

    if (
      isSupabaseAdminImport(specifier, resolvedPath) &&
      !allowedAdminClientImporters.has(projectPath)
    ) {
      violations.push({
        file: projectPath,
        import: specifier,
        rule: "createSupabaseAdminClient imports are limited to ADR 0010 Adapters",
      });
    }

    if (
      isSupabaseAuthAdminImport(specifier, resolvedPath) &&
      !allowedAuthAdminImporters.has(projectPath)
    ) {
      violations.push({
        file: projectPath,
        import: specifier,
        rule: "Supabase Auth Admin imports are limited to ADR 0010 feature data Adapters",
      });
    }

    if (isInside(projectPath, "src/components") && isSupabaseLibImport(specifier, resolvedPath)) {
      violations.push({
        file: projectPath,
        import: specifier,
        rule: "components must not import Supabase Adapters; pass data/actions through app or layout Interfaces",
      });
    }

    if (
      isInside(projectPath, "src/app") &&
      resolvedPath &&
      /^src\/features\/[^/]+\/data(\/|$)/.test(resolvedPath)
    ) {
      violations.push({
        file: projectPath,
        import: specifier,
        rule: "app routes must consume feature use-cases/read Modules, not feature data Adapters",
      });
    }

    if (
      isFeatureUseCase(projectPath) &&
      (specifier === "@/lib/supabase/server" || resolvedPath === "src/lib/supabase/server")
    ) {
      warnings.push({
        file: projectPath,
        import: specifier,
        rule: "features/*/use-cases should keep Supabase access behind data Adapters",
      });
    }

    if (
      !isTestSource(projectPath) &&
      isFeatureUseCase(projectPath) &&
      resolvedPath &&
      isFeatureData(resolvedPath) &&
      featureName(projectPath) !== featureName(resolvedPath)
    ) {
      warnings.push({
        file: projectPath,
        import: specifier,
        rule: "cross-feature data imports reduce Locality; prefer a narrow read Module in the owning feature",
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture guardrails failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file} imports ${violation.import}: ${violation.rule}`);
  }
  process.exitCode = 1;
} else {
  console.log("Architecture guardrails passed.");
}

if (warnings.length > 0) {
  console.log("");
  console.log("Architecture warnings:");
  for (const item of warnings) {
    console.log(`- ${item.file} imports ${item.import}`);
    console.log(`  ${item.rule}`);
  }
}
