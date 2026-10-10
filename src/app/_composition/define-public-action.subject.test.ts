import { beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { err, ok } from "@/infra/result";
import { definePublicAction } from "./define-public-action";

// Doble limite de inicio de sesion de punta a punta: IP global (100) y por IP y
// correo (10). El almacen compartido (RPC) se simula con contadores por clave.

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const rpc = vi.fn();
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
const GLOBAL = { max: 100, windowMs: 900_000 };
const ACCOUNT = { max: 10, windowMs: 900_000 };

// Cuenta cada clave y deniega cuando supera el maximo que pide la llamada.
function fakeStore() {
  const counts = new Map<string, number>();
  rpc.mockImplementation(async (_fn: string, args: { p_key: string; p_max: number }) => {
    const next = (counts.get(args.p_key) ?? 0) + 1;
    counts.set(args.p_key, next);
    return { data: [{ allowed: next <= args.p_max, retry_after_seconds: 1 }], error: null };
  });
}

function signIn() {
  const run = vi.fn(async () => ok(undefined));
  const action = definePublicAction({
    rateLimit: {
      scope: "sign-in",
      options: GLOBAL,
      subject: {
        options: ACCOUNT,
        keyFrom: (input: { email: string }) => input.email.trim().toLowerCase(),
      },
    },
    parse: (raw: string) => (raw.trim() ? ok({ email: raw }) : err("Dato inválido.")),
    run,
  });
  return { action, run };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "203.0.113.7" }) as never);
  fakeStore();
});

describe("definePublicAction: límite por cuenta e IP", () => {
  it("bloquea la cuenta tras 10 intentos aunque la IP global tenga margen", async () => {
    const { action, run } = signIn();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await action("ana@salonluna.com")).ok).toBe(true);
    }
    expect(await action("ana@salonluna.com")).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(run).toHaveBeenCalledTimes(10);

    const globalCalls = rpc.mock.calls.filter(([, args]) => args.p_key === "ip:203.0.113.7:sign-in");
    expect(globalCalls.length).toBe(11);
  });

  it("otra cuenta desde la misma IP no se ve afectada por el bloqueo de la primera", async () => {
    const { action } = signIn();
    for (let attempt = 0; attempt < 11; attempt += 1) await action("ana@salonluna.com");

    expect((await action("luis@salonluna.com")).ok).toBe(true);
  });

  it("el mismo correo con mayúsculas o espacios comparte contador", async () => {
    const { action, run } = signIn();
    for (let attempt = 0; attempt < 10; attempt += 1) await action("ana@salonluna.com");

    expect(await action("  Ana@SalonLuna.com ")).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(run).toHaveBeenCalledTimes(10);
  });

  it("la clave del límite por cuenta no contiene el correo en claro", async () => {
    const { action } = signIn();
    await action("ana@salonluna.com");

    const keys = rpc.mock.calls.map(([, args]) => args.p_key as string);
    expect(keys.some((key) => key.includes("subject:"))).toBe(true);
    expect(keys.every((key) => !key.includes("salonluna"))).toBe(true);
  });

  it("si el límite global bloquea no valida ni consulta la cuenta", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 1 }], error: null });
    const { action, run } = signIn();

    expect(await action("ana@salonluna.com")).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(run).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("una entrada inválida no consume el límite por cuenta", async () => {
    const { action } = signIn();

    expect(await action("   ")).toEqual(err("Dato inválido."));
    expect(rpc.mock.calls.every(([, args]) => !args.p_key.includes("subject:"))).toBe(true);
  });
});
