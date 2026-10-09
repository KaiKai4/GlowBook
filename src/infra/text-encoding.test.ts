import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda contra UTF-8 doblemente codificado: caracteres latin1 que son en realidad
// bytes UTF-8 de letras acentuadas. El patron se escribe con escapes para que este
// archivo no contenga el mojibake que busca.
const MOJIBAKE = /[\u00C2\u00C3][\u0080-\u00BF]/;
const SOURCE_EXTENSIONS = /\.(ts|tsx)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.test(entry) ? [path] : [];
  });
}

describe("codificacion de los fuentes", () => {
  it("no contiene texto UTF-8 doblemente codificado", () => {
    const root = join(process.cwd(), "src");
    const offenders = sourceFiles(root).filter((file) => MOJIBAKE.test(readFileSync(file, "utf8")));

    expect(offenders.map((file) => relative(process.cwd(), file))).toEqual([]);
  });
});
