import { describe, expect, it } from "vitest";
import { toCanonicalPayload } from "./canonical-json";

const canonicalJson = (value: unknown): string => JSON.stringify(toCanonicalPayload(value));

describe("canonicalJson", () => {
  it("ordena las claves de forma estable sin importar el orden de inserción", () => {
    expect(canonicalJson({ b: 1, a: { d: true, c: "x" } })).toBe(
      canonicalJson({ a: { c: "x", d: true }, b: 1 })
    );
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("normaliza números: 5 y 5.0 producen el mismo texto y -0 pasa a 0", () => {
    expect(canonicalJson({ price: 5.0 })).toBe(canonicalJson({ price: 5 }));
    expect(canonicalJson({ price: 5.0 })).toBe('{"price":5}');
    expect(canonicalJson([-0])).toBe("[0]");
    expect(canonicalJson({ price: 12.5 })).toBe('{"price":12.5}');
  });

  it("omite propiedades undefined y conserva null", () => {
    expect(canonicalJson({ a: undefined, b: null, c: "x" })).toBe('{"b":null,"c":"x"}');
  });

  it("rechaza números no finitos y tipos no serializables", () => {
    expect(() => canonicalJson({ price: Number.NaN })).toThrow(/Número no finito/);
    expect(() => canonicalJson({ price: Number.POSITIVE_INFINITY })).toThrow(/Número no finito/);
    expect(() => canonicalJson({ fn: () => 1 })).toThrow(/Tipo no serializable/);
    expect(() => canonicalJson({ big: BigInt(1) })).toThrow(/Tipo no serializable/);
  });

  it("toCanonicalPayload devuelve un valor JSON equivalente y canónico", () => {
    expect(toCanonicalPayload({ z: [1.0, { y: 2, x: undefined }], a: "s" })).toEqual({
      a: "s",
      z: [1, { y: 2 }],
    });
  });

  it("rechaza objetos que no son planos (Date, Map, Set, instancias de clase)", () => {
    class Cita {
      constructor(public readonly id: string) {}
    }

    expect(() => canonicalJson({ when: new Date(0) })).toThrow(TypeError);
    expect(() => canonicalJson({ when: new Date(0) })).toThrow(/\$\.when/);
    expect(() => canonicalJson({ tags: new Map([["a", 1]]) })).toThrow(/Objeto no plano/);
    expect(() => canonicalJson({ tags: new Set(["a"]) })).toThrow(/Objeto no plano/);
    expect(() => canonicalJson({ cita: new Cita("c1") })).toThrow(/\$\.cita/);
  });

  it("acepta objetos sin prototipo (Object.create(null))", () => {
    const plain = Object.assign(Object.create(null), { b: 2, a: 1 }) as Record<string, unknown>;

    expect(canonicalJson(plain)).toBe('{"a":1,"b":2}');
  });

  it("ordena las claves por unidades UTF-16 (Array.prototype.sort)", () => {
    // El emoji (surrogate pair D83D) ordena antes que U+FF5E en UTF-16, aunque su codepoint sea mayor.
    expect(canonicalJson({ "～": 1, "\u{1F600}": 2 })).toBe('{"\u{1F600}":2,"～":1}');
  });
});
