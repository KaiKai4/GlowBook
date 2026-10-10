import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import { toResult } from "./to-result";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const FALLBACK = "No se pudo guardar el cliente.";
const CONTEXT = { module: "clientes", action: "crear-cliente" };

describe("toResult", () => {
  beforeEach(() => {
    vi.mocked(captureError).mockClear();
  });

  it("devuelve ok con el valor cuando fn no lanza", async () => {
    const result = await toResult(async () => 42, { fallback: FALLBACK, context: CONTEXT });

    expect(result).toEqual({ ok: true, value: 42 });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("devuelve err con el mensaje de un PublicError sin registrarlo", async () => {
    const result = await toResult(
      async () => {
        throw new PublicError("El cliente ya está archivado.", { code: "archived" });
      },
      { fallback: FALLBACK, context: CONTEXT }
    );

    expect(result).toEqual({ ok: false, error: "El cliente ya está archivado." });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("devuelve el fallback ante un error técnico y registra con el contexto del caso de uso", async () => {
    const technical = new Error('relation "public.clients" does not exist');

    const result = await toResult(
      async () => {
        throw technical;
      },
      { fallback: FALLBACK, context: CONTEXT }
    );

    expect(result).toEqual({ ok: false, error: FALLBACK });
    expect(captureError).toHaveBeenCalledWith(technical, CONTEXT);
  });

  it("muestra un SQLSTATE mapeado sin registrar el error técnico", async () => {
    const result = await toResult(
      async () => {
        throw { code: "23505", message: "duplicate key value", details: null, hint: null };
      },
      { fallback: FALLBACK, context: CONTEXT }
    );

    expect(result).toEqual({ ok: false, error: "Ya existe un registro con esos datos." });
    expect(captureError).not.toHaveBeenCalled();
  });
});
