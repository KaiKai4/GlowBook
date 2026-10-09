import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Reglas de seguridad (error, sin excepciones por archivo). Ver docs/security.md.
const EVAL_RULES = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
};

const ZOD_MESSAGE = "Importa Zod desde '@/infra/validation/zod' (adaptador unico, jitless).";

const SWALLOWED_CATCH_MESSAGE =
  "Un .catch que no registra el error oculta fallos. Usa try/catch con captureError o runSideEffect (src/infra/effects/run-side-effect.ts).";

// Handlers de .catch vacios o que solo devuelven null/undefined.
const SWALLOWED_CATCH_SELECTORS = [
  "CallExpression[callee.property.name='catch'] > :matches(ArrowFunctionExpression, FunctionExpression)[body.type='BlockStatement'][body.body.length=0]",
  "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='Literal'][body.raw='null']",
  "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='Identifier'][body.name='undefined']",
  "CallExpression[callee.property.name='catch'] > :matches(ArrowFunctionExpression, FunctionExpression) > BlockStatement > ReturnStatement[argument.raw='null']",
];

const RESTRICTED_SYNTAX = [
  "error",
  {
    selector: "NewExpression[callee.name='RegExp'][arguments.0.type!='Literal']",
    message:
      "RegExp construida dinamicamente: riesgo de ReDoS. Usa un literal o una validacion sin regex dinamica.",
  },
  ...SWALLOWED_CATCH_SELECTORS.map((selector) => ({
    selector,
    message: SWALLOWED_CATCH_MESSAGE,
  })),
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
      "no-restricted-syntax": RESTRICTED_SYNTAX,
      // Zod se importa solo a traves del adaptador (src/infra/validation/zod.ts),
      // que desactiva la compilacion JIT (sin eval en runtime).
      "no-restricted-imports": [
        "error",
        {
          // "zod" exacto y subrutas; un patron sin barra coincidiria tambien con
          // alias como '@/infra/validation/zod' (semantica tipo gitignore).
          paths: [{ name: "zod", message: ZOD_MESSAGE }],
          patterns: [{ group: ["zod/*"], message: ZOD_MESSAGE }],
        },
      ],
    },
  },
  {
    files: ["src/infra/validation/zod.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs,ts}"],
    rules: {
      "no-restricted-syntax": RESTRICTED_SYNTAX,
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
    // Configuración local de Claude Code (incluye worktrees de agentes) y artefactos locales de calidad.
    ".claude/**",
    ".quality/**",
  ]),
]);

export default eslintConfig;
