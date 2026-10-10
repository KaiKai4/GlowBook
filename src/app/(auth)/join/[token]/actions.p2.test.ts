import { beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { acceptEmployeeInvitation } from "@/features/employees/use-cases/employee-invitations";
import { err, ok } from "@/infra/result";
import { acceptEmployeeInvitationAction } from "./actions";

const { rpc, signIn } = vi.hoisted(() => ({ rpc: vi.fn(), signIn: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/infra/auth/password-auth", () => ({ signInWithPassword: signIn }));
vi.mock("@/features/employees/use-cases/employee-invitations", () => ({
  acceptEmployeeInvitation: vi.fn(),
}));

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
const EMAIL = "empleada@salon.com";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "192.0.2.10" }) as never);
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
  signIn.mockResolvedValue({ error: null });
});

describe("acceptEmployeeInvitationAction (invitación de empleado, sin sesion)", () => {
  it("limita por IP con la clave join-invitation", async () => {
    vi.mocked(acceptEmployeeInvitation).mockResolvedValue(ok(undefined) as never);

    await acceptEmployeeInvitationAction("tok", "clave-1", EMAIL);

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:192.0.2.10:join-invitation",
      p_max: 10,
      p_window_seconds: 60,
    });
  });

  it("bloquea por rate limit sin aceptar la invitación ni iniciar sesión", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const result = await acceptEmployeeInvitationAction("tok", "clave-1", EMAIL);

    expect(result).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(acceptEmployeeInvitation).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("si la invitación falla devuelve el error y no inicia sesión", async () => {
    vi.mocked(acceptEmployeeInvitation).mockResolvedValue(err("Invitación inválida.") as never);

    const result = await acceptEmployeeInvitationAction("tok", "clave-1", EMAIL);

    expect(acceptEmployeeInvitation).toHaveBeenCalledWith({ token: "tok", password: "clave-1" });
    expect(result).toEqual(err("Invitación inválida."));
    expect(signIn).not.toHaveBeenCalled();
  });

  it("si la invitación se acepta inicia sesión con el correo de la invitación y devuelve signedIn", async () => {
    vi.mocked(acceptEmployeeInvitation).mockResolvedValue(ok(undefined) as never);

    const result = await acceptEmployeeInvitationAction("tok", "clave-1", EMAIL);

    expect(signIn).toHaveBeenCalledWith({ email: EMAIL, password: "clave-1" });
    expect(result).toEqual(ok({ signedIn: true }));
  });

  it("si el inicio de sesión falla la cuenta queda creada y devuelve signedIn false", async () => {
    vi.mocked(acceptEmployeeInvitation).mockResolvedValue(ok(undefined) as never);
    signIn.mockResolvedValue({ error: new Error("Invalid login credentials") });

    const result = await acceptEmployeeInvitationAction("tok", "clave-1", EMAIL);

    expect(result).toEqual(ok({ signedIn: false }));
  });
});
