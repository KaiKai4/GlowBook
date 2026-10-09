import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Reglas propias que dependency-cruiser (.dependency-cruiser.cjs) no cubre.
// Las reglas de capa por patron (domain puro, admin client, cross-module, etc.) viven alli.

const root = process.cwd();
const srcRoot = path.join(root, "src");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const importPatterns = [
  /import\s+(?:type\s+)?[^'"]*?\s+from\s*["']([^"']+)["']/g,
  /import\s*["']([^"']+)["']/g,
  /export\s+(?:type\s+)?[^'"]*?\s+from\s*["']([^"']+)["']/g,
];

/** @param {string} filePath */
function toProjectPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

/** @param {string} projectPath @param {string} dir */
function isInside(projectPath, dir) {
  return projectPath === dir || projectPath.startsWith(`${dir}/`);
}

/** @param {string} fromFile @param {string} specifier */
function resolveImport(fromFile, specifier) {
  if (specifier.startsWith("@/")) {
    return toProjectPath(path.join(srcRoot, specifier.slice(2)));
  }

  if (specifier.startsWith(".")) {
    return toProjectPath(path.resolve(path.dirname(fromFile), specifier));
  }

  return null;
}

/** @param {string} dir @returns {string[]} */
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

/** @param {string} dir @returns {string[]} */
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

/** @param {string} source */
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

/** @param {string} projectPath */
function isTestSource(projectPath) {
  return /\.(test|spec)\.[jt]sx?$/.test(projectPath);
}

/** @param {string} projectPath */
function isFeatureUseCase(projectPath) {
  return /^src\/features\/[^/]+\/use-cases(\/|$)/.test(projectPath);
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
  // Los tests quedan fuera de las reglas de capas (importan modulos para mockearlos).
  if (isTestSource(projectPath)) continue;
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
      (specifier === "@/infra/supabase/server" || resolvedPath === "src/infra/supabase/server")
    ) {
      warnings.push({
        file: projectPath,
        import: specifier,
        rule: "features/*/use-cases should keep Supabase access behind data Adapters",
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
