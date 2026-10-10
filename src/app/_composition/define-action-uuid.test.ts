import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/infra/result";
import { parseUuidField } from "./define-action";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./request-context", () => ({ requireActiveProfile: vi.fn() }));

const UUID = "00000000-0000-4000-8000-000000000001";

describe("parseUuidField", () => {
  it("devuelve el identificador cuando es un UUID bien formado", () => {
    expect(parseUuidField(UUID)).toEqual(ok(UUID));
  });

  it("rechaza cualquier otro valor con el mensaje de identificador inválido", () => {
    expect(parseUuidField("no-es-uuid")).toEqual(err("Identificador inválido."));
    expect(parseUuidField("")).toEqual(err("Identificador inválido."));
  });
});
