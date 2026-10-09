// Pruebas del formateador determinista de tipos de BD y de la comparación de deriva (node:test).
// No requieren Supabase: el generador real solo se ejecuta con "npm run db:types" contra la base local.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertDatabaseTypesOutput,
  formatDatabaseTypes,
  sameDatabaseTypes,
} from "./generate-db-types.mjs";

const COMPACT = [
  "export type Json = string | number | null",
  "",
  "export type Database = {",
  '  "public": {',
  "    Tables: {",
  '      "appointments": {',
  "        Row: {",
  '          "id": string,"salon_id": string,"notes": string | null',
  "        }",
  "      }",
  "    }",
  "  }",
  "}",
  "",
].join("\n");

const SPACED_KEYS = [
  "export type Json = string | number | null",
  "",
  "export type Database = {",
  "  public: {",
  "    Tables: {",
  "      appointments: {",
  "        Row: {",
  "          id: string",
  "          salon_id: string",
  "          notes: string | null",
  "        }",
  "      }",
  "    }",
  "  }",
  "}",
  "",
].join("\n");

describe("formatDatabaseTypes", () => {
  it("imprime las columnas de objeto una por línea", () => {
    const out = formatDatabaseTypes(COMPACT);
    const lines = out.split("\n");
    assert.ok(lines.some((l) => l.trim() === "salon_id: string;"));
    assert.ok(lines.some((l) => l.trim() === "id: string;"));
    assert.ok(lines.length > 10, "la salida debe ser multilínea");
  });

  it("es determinista: la misma entrada compacta o multilínea produce la misma salida", () => {
    assert.equal(formatDatabaseTypes(COMPACT), formatDatabaseTypes(SPACED_KEYS));
  });

  it("es idempotente: formatear dos veces no cambia el resultado", () => {
    const once = formatDatabaseTypes(COMPACT);
    assert.equal(formatDatabaseTypes(once), once);
  });

  it("normaliza EOL: CRLF y LF producen la misma salida sin retornos de carro", () => {
    const crlf = COMPACT.replace(/\n/g, "\r\n");
    const out = formatDatabaseTypes(crlf);
    assert.equal(out, formatDatabaseTypes(COMPACT));
    assert.ok(!out.includes("\r"));
  });

  it("termina con un único salto de línea final", () => {
    const out = formatDatabaseTypes(COMPACT);
    assert.ok(out.endsWith("};\n"));
    assert.ok(!out.endsWith("\n\n"));
  });
});

describe("sameDatabaseTypes", () => {
  it("considera iguales textos que solo difieren en presentación", () => {
    assert.equal(sameDatabaseTypes(COMPACT, SPACED_KEYS), true);
    assert.equal(sameDatabaseTypes(COMPACT, COMPACT.replace(/\n/g, "\r\n")), true);
  });

  it("detecta drift real de columnas", () => {
    const withExtraColumn = COMPACT.replace('"notes": string | null', '"notes": string | null,"extra": number');
    assert.equal(sameDatabaseTypes(COMPACT, withExtraColumn), false);
  });

  it("detecta drift real de tipos", () => {
    const changedType = COMPACT.replace('"id": string', '"id": number');
    assert.equal(sameDatabaseTypes(COMPACT, changedType), false);
  });
});

describe("assertDatabaseTypesOutput", () => {
  it("acepta salida que contiene el tipo Database", () => {
    assert.equal(assertDatabaseTypesOutput(COMPACT), COMPACT);
  });

  it("rechaza salida sin el tipo Database", () => {
    assert.throws(() => assertDatabaseTypesOutput("export type Json = string\n"), /no contiene el tipo Database/);
  });
});
