// Genera el SBOM CycloneDX de las dependencias de producción en
// .quality/sbom.json (artefacto local, ignorado por git).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, runArgv } from "./lib-process.mjs";

const OUTPUT_DIR = join(ROOT, ".quality");
const OUTPUT_PATH = join(OUTPUT_DIR, "sbom.json");

const result = runArgv(
  ["npm", "sbom", "--omit", "dev", "--sbom-format", "cyclonedx"],
  { capture: true }
);
if (result.error) {
  console.error(`[sbom] No se pudo ejecutar npm sbom: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  console.error(`[sbom] npm sbom terminó con código ${result.status}.`);
  process.exit(result.status);
}

let document;
try {
  document = JSON.parse(result.stdout);
} catch {
  console.error("[sbom] npm sbom no devolvió un JSON válido.");
  process.exit(1);
}
if (document.bomFormat !== "CycloneDX") {
  console.error("[sbom] El documento generado no es CycloneDX.");
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`[sbom] ${document.components?.length ?? 0} componente(s) escritos en .quality/sbom.json.`);
