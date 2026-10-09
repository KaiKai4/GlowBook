import { beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { acceptInvitation } from "@/features/platform/use-cases/accept-invitation";
import { err, ok } from "@/lib/result";
import { acceptInvitationAction } from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/features/platform/use-cases/accept-invitation", () => ({
  acceptInvitation: vi.fn(),
}));

const INPUT = {
  token: "token-123",
  email: "dueno@salon.com",
  password: "Clave-segura-1",
  salon_name: "Salón Centro",
  full_name: "Dueña Ejemplo",
};
const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

function requestHeaders(values: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(values) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  requestHeaders({ "x-real-ip": "203.0.113.7" });
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
});

describe("acceptInvitationAction (invitacion de salon, sin sesion)", () => {
  it("limita por IP usando x-real-ip con el maximo anonimo de 10 por minuto", async () => {
    vi.mocked(acceptInvitation).mockResolvedValue(ok(undefined));

    await acceptInvitationAction(INPUT);

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:203.0.113.7:accept-invitation",
      p_max: 10,
      p_window_seconds: 60,
    });
  });

  it("bloquea por rate limit sin aceptar la invitacion", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const result = await acceptInvitationAction(INPUT);

    expect(result).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("acepta la invitacion con los datos recibidos y devuelve su resultado", async () => {
    vi.mocked(acceptInvitation).mockResolvedValue(ok(undefined));

    const result = await acceptInvitationAction(INPUT);

    expect(acceptInvitation).toHaveBeenCalledWith(INPUT);
    expect(result).toEqual(ok(undefined));
  });

  it("devuelve el error de validacion del caso de uso tal cual", async () => {
    vi.mocked(acceptInvitation).mockResolvedValue(err("El enlace ha caducado."));

    const result = await acceptInvitationAction(INPUT);

    expect(result).toEqual(err("El enlace ha caducado."));
  });

  it("CONDUCTA ACTUAL (posible bug): usa el primer valor de x-forwarded-for cuando falta x-real-ip (suplantable fuera de Vercel)", async () => {
    requestHeaders({ "x-forwarded-for": "198.51.100.4, 10.0.0.1" });
    vi.mocked(acceptInvitation).mockResolvedValue(ok(undefined));

    await acceptInvitationAction(INPUT);

    expect(rpc).toHaveBeenCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_key: "ip:198.51.100.4:accept-invitation" })
    );
  });

  it("agrupa en el bucket 'unknown' cuando no llega ninguna IP", async () => {
    requestHeaders({});
    vi.mocked(acceptInvitation).mockResolvedValue(ok(undefined));

    await acceptInvitationAction(INPUT);

    expect(rpc).toHaveBeenCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_key: "ip:unknown:accept-invitation" })
    );
  });
});
