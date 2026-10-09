// Preset de secretlint usado por el escaneo de secretos (check-secrets.mjs).
// La configuración vive en el campo "secretlint" de package.json y referencia
// el preset por id. Este módulo importa el preset de forma explícita para
// comprobar que carga con reglas antes de escanear.
import { rules } from "@secretlint/secretlint-rule-preset-recommend";

const SECRETLINT_PRESET_ID = "@secretlint/secretlint-rule-preset-recommend";

/**
 * Lanza un error si el preset no exporta reglas (escaneo sin cobertura).
 * @returns {void}
 */
export function assertSecretlintPreset() {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error(`El preset ${SECRETLINT_PRESET_ID} no exporta reglas.`);
  }
}
