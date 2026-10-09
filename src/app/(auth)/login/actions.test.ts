import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { err, ok } from "@/infra/result";
import { signInAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/auth/password-auth", () => ({ signInWithPassword: vi.fn() }));

const SIGN_IN_ERROR = "No pudimos iniciar sesión con esos datos.";
const INPUT = { email: "ana@salonluna.com", password: "clave-segura-1", remember: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(signInWithPassword).mockResolvedValue({ error: null });
});

describe("signInAction", () => {
  it("inicia sesion con las credenciales y la preferencia recordarme", async () => {
    const result = await signInAction(INPUT);

    expect(signInWithPassword).toHaveBeenCalledWith(INPUT);
    expect(result).toEqual(ok(undefined));
  });

  it("pasa 'no recordarme' al servidor para que la sesion sea solo de esta visita", async () => {
    await signInAction({ ...INPUT, remember: false });

    expect(signInWithPassword).toHaveBeenCalledWith({ ...INPUT, remember: false });
  });

  it("con credenciales incorrectas devuelve el mensaje genérico", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ error: { message: "Invalid login credentials" } as never });

    const result = await signInAction(INPUT);

    expect(result).toEqual(err(SIGN_IN_ERROR));
  });

  it("con el correo sin confirmar devuelve el mismo mensaje genérico", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ error: { code: "email_not_confirmed" } as never });

    const result = await signInAction(INPUT);

    expect(result).toEqual(err(SIGN_IN_ERROR));
  });

  it("rechaza una entrada sin correo sin llamar a Supabase", async () => {
    const result = await signInAction({ ...INPUT, email: "   " });

    expect(result).toEqual(err(SIGN_IN_ERROR));
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rechaza una entrada sin contraseña sin llamar a Supabase", async () => {
    const result = await signInAction({ ...INPUT, password: "" });

    expect(result).toEqual(err(SIGN_IN_ERROR));
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
