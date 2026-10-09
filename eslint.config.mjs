import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Reglas de seguridad (error, sin excepciones por archivo). Ver docs/security.md.
const EVAL_RULES = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
};

const ZOD_MESSAGE = "Importa Zod desde '@/lib/validation/zod' (adaptador unico, jitless).";

const DYNAMIC_REGEXP_RULE = [
  "error",
  {
    selector: "NewExpression[callee.name='RegExp'][arguments.0.type!='Literal']",
    message:
      "RegExp construida dinamicamente: riesgo de ReDoS. Usa un literal o una validacion sin regex dinamica.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    rules: EVAL_RULES,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "react/no-danger": "error",
      "no-restricted-syntax": DYNAMIC_REGEXP_RULE,
      // Zod se importa solo a traves del adaptador (src/lib/validation/zod.ts),
      // que desactiva la compilacion JIT (sin eval en runtime).
      "no-restricted-imports": [
        "error",
        {
          // "zod" exacto y subrutas; un patron sin barra coincidiria tambien con
          // alias como '@/lib/validation/zod' (semantica tipo gitignore).
          paths: [{ name: "zod", message: ZOD_MESSAGE }],
          patterns: [{ group: ["zod/*"], message: ZOD_MESSAGE }],
        },
      ],
    },
  },
  {
    files: ["src/lib/validation/zod.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs,ts}"],
    rules: {
      "no-restricted-syntax": DYNAMIC_REGEXP_RULE,
      // Los scripts usan execFile/spawn con argumentos separados. exec/execSync
      // interpretan el comando en una shell y se prohiben.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "child_process",
              importNames: ["exec", "execSync"],
              message: "Usa execFile/spawn con argumentos separados (sin shell).",
            },
            {
              name: "node:child_process",
              importNames: ["exec", "execSync"],
              message: "Usa execFile/spawn con argumentos separados (sin shell).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    // Artefactos del prebuild de Vercel CLI (vercel build): no son fuente.
    ".vercel/**",
    // Salidas generadas de cobertura y de mutación: no son fuente.
    "coverage/**",
    ".stryker-tmp/**",
  ]),
]);

export default eslintConfig;
