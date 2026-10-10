import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";
import { err, ok } from "@/infra/result";
import { definePublicAction } from "./define-public-action";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/security/rate-limit", () => ({ assertAnonymousRateLimit: vi.fn() }));

const mockedLimit = vi.mocked(assertAnonymousRateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  mockedLimit.mockResolvedValue(ok(undefined));
});

describe("definePublicAction", () => {
  it("aplica el limite por IP con el ambito y las opciones indicadas", async () => {
    const action = definePublicAction({
      rateLimit: { scope: "sign-in", options: { max: 20, windowMs: 900_000 } },
      parse: (raw: string) => ok(raw),
      run: async () => ok(undefined),
    });

    await action("x");

    expect(mockedLimit).toHaveBeenCalledWith("sign-in", { max: 20, windowMs: 900_000 });
  });

  it("sin opciones delega en el limite anonimo por defecto", async () => {
    const action = definePublicAction({
      rateLimit: { scope: "accept-invitation" },
      parse: (raw: string) => ok(raw),
      run: async () => ok(undefined),
    });

    await action("x");

    expect(mockedLimit).toHaveBeenCalledWith("accept-invitation", undefined);
  });

  it("si el limite bloquea devuelve su error sin validar ni ejecutar el caso de uso", async () => {
    mockedLimit.mockResolvedValue(err("Demasiados intentos."));
    const parse = vi.fn((raw: string) => ok(raw));
    const run = vi.fn(async () => ok(undefined));
    const action = definePublicAction({ rateLimit: { scope: "x" }, parse, run });

    const result = await action("x");

    expect(result).toEqual(err("Demasiados intentos."));
    expect(parse).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("un dato invalido devuelve el error del parser sin ejecutar el caso de uso", async () => {
    const run = vi.fn(async () => ok(undefined));
    const action = definePublicAction({
      rateLimit: { scope: "x" },
      parse: () => err("Dato inválido."),
      run,
    });

    expect(await action("x")).toEqual(err("Dato inválido."));
    expect(run).not.toHaveBeenCalled();
  });

  it("pasa al caso de uso el valor parseado y devuelve su resultado", async () => {
    const run = vi.fn(async (input: { n: number }) => ok(input.n * 2));
    const action = definePublicAction({
      rateLimit: { scope: "x" },
      parse: (raw: string) => ok({ n: Number(raw) }),
      run,
    });

    expect(await action("21")).toEqual(ok(42));
    expect(run).toHaveBeenCalledWith({ n: 21 });
  });
});
