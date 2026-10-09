// Extrae la URL del despliegue staged de la salida de `vercel deploy --prebuilt --prod --skip-domain`.
// Uso: node scripts/release/deployment-url.mjs <fichero-salida>
// Imprime solo la URL (https://*.vercel.app) o termina con código 1.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isVercelDeployUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app") && url.pathname === "/";
  } catch {
    return false;
  }
}

/**
 * La CLI imprime la URL del despliegue al final; se toma la última válida.
 * @param {string} output
 * @returns {string | null}
 */
export function extractDeploymentUrl(output) {
  const candidates = (output.match(/https:\/\/[^\s"'<>]+/g) ?? [])
    .map((raw) => raw.replace(/[),.;]+$/, ""))
    .map((raw) => {
      try {
        return new URL(raw).origin;
      } catch {
        return "";
      }
    })
    .filter((origin) => isVercelDeployUrl(origin));
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

/** @returns {void} */
function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("[deployment-url] FALLO: falta la ruta del fichero de salida.");
    process.exit(1);
  }
  const url = extractDeploymentUrl(readFileSync(file, "utf8"));
  if (url === null) {
    console.error("[deployment-url] FALLO: no se encontró una URL de despliegue *.vercel.app en la salida.");
    process.exit(1);
  }
  console.log(url);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
