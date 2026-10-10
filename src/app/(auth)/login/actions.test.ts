import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { err, ok } from "@/infra/result";
import { signInAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/security/rate-limit", () => ({ assertAnonymousRateLimit: vi.fn() }));
vi.mock("@/infra/auth/password-auth", () => ({ signInWithPassword: vi.fn() }));

const SIGN_IN_ERROR = "No pudimos iniciar sesión con esos datos.";
const INPUT = { email: "ana@salonluna.com", password: "clave-segura-1", remember: true };

beforeEach(() => {
  vi.mocked(assertAnonymousRateLimit).mockResolvedValue(ok(undefined));
  vi.clearAllMocks();
  vi.mocked(signInWithPassword).mockResolvedValue({ error: null });
});

describe("signInAction", () => {
  it("inicia sesión con las credenciales y la preferencia recordarme", async () => {
    const result = await signInAction(INPUT);

    expect(signInWithPassword).toHaveBeenCalledWith(INPUT);
    expect(result).toEqual(ok(undefined));
  });

  it("pasa 'no recordarme' al servidor para que la sesión sea solo de esta visita", async () => {
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

describe("signInAction con límite por IP", () => {
  it("aplica el límite de inicio de sesión por IP antes de tocar la autenticacion", async () => {
    await signInAction(INPUT);

    expect(assertAnonymousRateLimit).toHaveBeenCalledWith("sign-in", { max: 20, windowMs: 900_000 });
  });

  it("si el límite bloquea no intenta iniciar sesión y devuelve el aviso de límite", async () => {
    vi.mocked(assertAnonymousRateLimit).mockResolvedValue(err("Demasiados intentos. Espera un momento y vuelve a intentarlo."));

    const result = await signInAction(INPUT);

    expect(result).toEqual(err("Demasiados intentos. Espera un momento y vuelve a intentarlo."));
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
