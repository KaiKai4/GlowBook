// Pruebas de la categoría "invalid" del trinquete de tokens de diseño.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { countTokens } from "./check-design-tokens.mjs";
import { countInvalidClassTokens } from "./design-token-classes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;

test("detecta clases corruptas en className con literal de cadena", () => {
  assert.equal(countInvalidClassTokens('<p className="undefineds font-medium">x</p>'), 1);
});

test("detecta clases corruptas con variante delante (hover:, md:)", () => {
  assert.equal(countInvalidClassTokens('<p className="md:hover:nullpx-2 text-xs">x</p>'), 1);
});

test("detecta NaN al inicio de un token dentro de cn()", () => {
  assert.equal(countInvalidClassTokens('cn("text-sm", "NaNpx")'), 1);
});

test("detecta corruptas en argumentos anidados de cva()", () => {
  const source = `const v = cva("base", { variants: { size: { sm: "undefinedxs", lg: "text-lg" } } });`;
  assert.equal(countInvalidClassTokens(source), 1);
});

test("detecta corruptas en className={cn(...)} sin contarlas dos veces", () => {
  assert.equal(countInvalidClassTokens('<p className={cn("null text-xs")} />'), 1);
});

test("no marca clases válidas ni texto fuera de clases", () => {
  const source = [
    '<p className="text-xs font-semibold text-fg">Texto undefined en contenido</p>',
    'const label = "null";',
    'cn("bg-surface", "hover:text-fg-muted")',
  ].join("\n");
  assert.equal(countInvalidClassTokens(source), 0);
});

test("countTokens expone la categoría invalid junto a las demás", () => {
  const counts = countTokens('<p className="undefineds text-[10px] font-bold">x</p>');
  assert.deepEqual(counts, { rawPalette: 0, hex: 0, fontSize: 1, fontWeight: 1, invalid: 1 });
});

test("ningún archivo de src/ (sin tests) contiene clases corruptas", () => {
  const offenders = [];
  const walk = (relativeDir) => {
    for (const entry of readdirSync(path.join(ROOT, relativeDir), { withFileTypes: true })) {
      const relativePath = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(relativePath);
      } else if (/\.(ts|tsx|css)$/.test(entry.name) && !TEST_FILE.test(entry.name)) {
        const invalid = countInvalidClassTokens(readFileSync(path.join(ROOT, relativePath), "utf8"));
        if (invalid > 0) offenders.push(`${relativePath}: ${invalid}`);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});
