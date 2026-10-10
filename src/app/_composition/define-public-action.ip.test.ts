import { beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { err, ok } from "@/infra/result";
import { definePublicAction } from "./define-public-action";

// Limite por IP de punta a punta: el limitador real consulta la RPC del almacen
// (service_role mockeado) con la IP del cliente como parte de la clave.

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const rpc = vi.fn();
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

function action(run: () => Promise<unknown>) {
  return definePublicAction({
    rateLimit: { scope: "sign-in", options: { max: 20, windowMs: 900_000 } },
    parse: (raw: string) => ok(raw),
    run: async () => (await run(), ok(undefined)),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
});

describe("definePublicAction: límite por IP", () => {
  it("usa la IP del cliente (x-real-ip) como parte de la clave del limite", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "203.0.113.7" }) as never);

    await action(async () => undefined)("x");

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:203.0.113.7:sign-in",
      p_max: 20,
      p_window_seconds: 900,
    });
  });

  it("si la IP supera el límite no ejecuta el caso de uso y devuelve el aviso", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "203.0.113.7" }) as never);
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });
    const run = vi.fn(async () => undefined);

    const result = await action(run)("x");

    expect(result).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(run).not.toHaveBeenCalled();
  });

  it("una IP distinta tiene su propio contador y no se bloquea por la anterior", async () => {
    rpc.mockImplementation(async (_fn: string, args: { p_key: string }) => ({
      data: [{ allowed: args.p_key !== "ip:198.51.100.1:sign-in" }],
      error: null,
    }));
    const run = vi.fn(async () => undefined);
    const submit = action(run);

    vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "198.51.100.1" }) as never);
    expect(await submit("x")).toEqual(err(RATE_LIMIT_MESSAGE));

    vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "203.0.113.9" }) as never);
    expect(await submit("x")).toEqual(ok(undefined));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("sin cabeceras de IP usa el bucket compartido con el limite relajado (x10)", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers() as never);

    await action(async () => undefined)("x");

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:unknown:sign-in",
      p_max: 200,
      p_window_seconds: 900,
    });
  });
});
