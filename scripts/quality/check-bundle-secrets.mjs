// Comprobador de secretos en los artefactos públicos del navegador.
// Revisa .next/static y public en busca de:
//   (a) el nombre literal SUPABASE_SERVICE_ROLE_KEY;
//   (b) el valor de SUPABASE_SERVICE_ROLE_KEY del entorno (JWT service_role del Supabase local,
//       inyectado por verify.mjs en los pasos con needsDb). El valor nunca se imprime.
// Requiere haber ejecutado antes el paso build (genera .next/static).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SECRET_ENV = "SUPABASE_SERVICE_ROLE_KEY";
const PUBLIC_DIRS = [".next/static", "public"];

/**
 * @typedef {{ path: string, content: string }} SourceFile
 * @typedef {{ label: string, value: string }} Needle
 * @typedef {{ path: string, needle: string }} Finding
 */

/**
 * Lista recursiva de ficheros bajo un directorio. Si no existe, devuelve [].
 * @param {string} dir
 * @returns {string[]}
 */
export function listFiles(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(absolute));
    } else if (entry.isFile()) {
      out.push(absolute);
    }
  }
  return out;
}

/**
 * Busca cada aguja en el contenido de cada fichero. Devuelve el nombre de la aguja (label), nunca su valor.
 * @param {{ files: SourceFile[], needles: Needle[] }} input
 * @returns {Finding[]}
 */
export function findSecretLeaks({ files, needles }) {
  /** @type {Finding[]} */
  const findings = [];
  for (const file of files) {
    for (const needle of needles) {
      if (needle.value.length > 0 && file.content.includes(needle.value)) {
        findings.push({ path: file.path, needle: needle.label });
      }
    }
  }
  return findings;
}

/**
 * Construye las agujas: el nombre literal y, si hay valor no vacío en el entorno, ese valor.
 * @param {NodeJS.ProcessEnv} env
 * @returns {Needle[]}
 */
export function buildNeedles(env) {
  /** @type {Needle[]} */
  const needles = [{ label: `nombre literal ${SECRET_ENV}`, value: SECRET_ENV }];
  const secret = env[SECRET_ENV]?.trim() ?? "";
  if (secret.length > 0) {
    needles.push({ label: `valor de ${SECRET_ENV}`, value: secret });
  }
  return needles;
}

function main() {
  if (!existsSync(join(ROOT, ".next", "static"))) {
    console.error("[bundle-secrets] ERROR: no existe .next/static. Ejecuta antes el paso build.");
    process.exit(1);
  }
  if ((process.env[SECRET_ENV]?.trim() ?? "") === "") {
    console.error(`[bundle-secrets] ERROR: ${SECRET_ENV} no está en el entorno. El paso debe correr con el entorno local inyectado.`);
    process.exit(1);
  }

  const paths = PUBLIC_DIRS.flatMap((dir) => listFiles(join(ROOT, dir)));
  const files = paths.map((absolute) => ({
    path: relative(ROOT, absolute).split(sep).join("/"),
    content: readFileSync(absolute, "utf8"),
  }));
  const findings = findSecretLeaks({ files, needles: buildNeedles(process.env) });

  if (findings.length > 0) {
    console.error(`[bundle-secrets] ERROR: ${findings.length} hallazgos en artefactos públicos:`);
    for (const finding of findings) console.error(`  - ${finding.path} (${finding.needle})`);
    process.exit(1);
  }
  console.log(`[bundle-secrets] OK: ${files.length} archivos revisados`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
