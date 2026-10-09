// Genera los tipos TypeScript de la base de datos LOCAL (Docker) con "supabase gen types".
// Uso directo (npm run db:types): escribe src/types/database.types.ts desde Supabase local.
// Nunca usa staging ni producción. Al importarse solo exporta funciones (sin efectos).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureLocalSupabase } from "./supabase-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI_ENTRY = path.join(ROOT, "node_modules", "supabase", "dist", "supabase.js");
export const DATABASE_TYPES_PATH = path.join(ROOT, "src", "types", "database.types.ts");

// Mismos schemas que el archivo versionado (solo public).
const SCHEMAS = ["public"];

// Devuelve el TypeScript generado desde la base local, sin escribir nada.
export function generateLocalDatabaseTypes() {
  const result = spawnSync(
    process.execPath,
    [CLI_ENTRY, "gen", "types", "typescript", "--local", "--schema", SCHEMAS.join(",")],
    { cwd: ROOT, encoding: "utf8", shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
  );

  if (result.error || result.status !== 0) {
    const stderr = (result.stderr ?? "").trim().slice(-1500);
    throw new Error(`No se pudieron generar los tipos desde Supabase local.\n${stderr}`);
  }

  const output = result.stdout ?? "";
  if (!output.includes("export type Database")) {
    throw new Error("La salida de \"supabase gen types\" no contiene el tipo Database.");
  }
  return output;
}

async function main() {
  await ensureLocalSupabase();
  const types = generateLocalDatabaseTypes();
  writeFileSync(DATABASE_TYPES_PATH, types, "utf8");
  console.log(`Tipos generados desde la base LOCAL en ${path.relative(ROOT, DATABASE_TYPES_PATH)}.`);
}

const isDirectRun = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
