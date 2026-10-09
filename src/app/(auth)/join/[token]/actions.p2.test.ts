import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { acceptEmployeeInvitation } from "@/features/employees/use-cases/employee-invitations";
import { err, ok } from "@/lib/result";
import { acceptEmployeeInvitationAction } from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((location: string) => {
    throw new Error(`NEXT_REDIRECT:${location}`);
  }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/features/employees/use-cases/employee-invitations", () => ({
  acceptEmployeeInvitation: vi.fn(),
}));

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "192.0.2.10" }) as never);
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
});

describe("acceptEmployeeInvitationAction (invitacion de empleado, sin sesion)", () => {
  it("limita por IP con la clave join-invitation", async () => {
    vi.mocked(acceptEmployeeInvitation).mockResolvedValue(ok(undefined) as never);

    await expect(acceptEmployeeInvitationAction("tok", "clave-1")).rejects.toThrow(
      "NEXT_REDIRECT:/login?joined=1"
    );

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:192.0.2.10:join-invitation",
      p_max: 10,
      p_window_seconds: 60,
    });
  });

  it("bloquea por rate limit sin aceptar la invitacion ni redirigir", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const result = await acceptEmployeeInvitationAction("tok", "clave-1");

    expect(result).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(acceptEmployeeInvitation).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("si la invitacion falla devuelve el resultado y no redirige", async () => {
    vi.mocked(acceptEmployeeInvitation).mockResolvedValue(err("Invitación inválida.") as never);

    const result = await acceptEmployeeInvitationAction("tok", "clave-1");

    expect(acceptEmployeeInvitation).toHaveBeenCalledWith({ token: "tok", password: "clave-1" });
    expect(result).toEqual(err("Invitación inválida."));
    expect(redirect).not.toHaveBeenCalled();
  });

  it("si la invitacion se acepta redirige a /login?joined=1", async () => {
    vi.mocked(acceptEmployeeInvitation).mockResolvedValue(ok(undefined) as never);

    await expect(acceptEmployeeInvitationAction("tok", "clave-1")).rejects.toThrow(
      "NEXT_REDIRECT:/login?joined=1"
    );
    expect(redirect).toHaveBeenCalledWith("/login?joined=1");
  });
});
