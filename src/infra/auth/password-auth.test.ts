import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import {
  establishRecoverySession,
  requestPasswordReset,
  signInWithPassword,
  signOutCurrentSession,
  updateCurrentPassword,
} from "./password-auth";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const cookieSet = vi.fn();
const auth = {
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({ set: cookieSet } as never);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth } as never);
  for (const fn of Object.values(auth)) fn.mockResolvedValue({ data: {}, error: null });
});

describe("marcador de recordarme (setRememberSession dentro de signInWithPassword)", () => {
  it("con recordarme borra el marcador de solo sesión", async () => {
    await signInWithPassword({ email: "a@b.com", password: "clave-1", remember: true });

    expect(cookieSet).toHaveBeenCalledWith("gb-session-only", "", {
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });
  });

  it("sin recordarme escribe el marcador como cookie de sesion (sin Max-Age)", async () => {
    await signInWithPassword({ email: "a@b.com", password: "clave-1", remember: false });

    expect(cookieSet).toHaveBeenCalledWith("gb-session-only", "1", {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  });
});

describe("signInWithPassword", () => {
  it("escribe el marcador y abre el cliente en modo solo sesión cuando no se quiere recordar", async () => {
    await signInWithPassword({ email: "a@b.com", password: "clave-1", remember: false });

    expect(cookieSet).toHaveBeenCalledWith("gb-session-only", "1", expect.any(Object));
    expect(createSupabaseServerClient).toHaveBeenCalledWith({ sessionOnly: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "clave-1" });
  });

  it("con recordarme abre el cliente con cookies persistentes", async () => {
    await signInWithPassword({ email: "a@b.com", password: "clave-1", remember: true });

    expect(createSupabaseServerClient).toHaveBeenCalledWith({ sessionOnly: false });
  });

  it("sin preferencia explicita respeta el marcador de la peticion", async () => {
    await signInWithPassword({ email: "a@b.com", password: "clave-1" });

    expect(cookieSet).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).toHaveBeenCalledWith({});
  });

  it("devuelve el error de Supabase sin lanzarlo", async () => {
    const error = { message: "Invalid login credentials" };
    auth.signInWithPassword.mockResolvedValue({ data: {}, error });

    const outcome = await signInWithPassword({ email: "a@b.com", password: "mala", remember: true });

    expect(outcome.error).toBe(error);
  });
});

describe("requestPasswordReset", () => {
  it("construye el enlace de recuperacion con el origen indicado", async () => {
    await requestPasswordReset("a@b.com", "https://glowbook.app");

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "https://glowbook.app/reset-password",
    });
  });
});

describe("establishRecoverySession", () => {
  it("canjea el código PKCE y reporta éxito", async () => {
    await expect(establishRecoverySession({ kind: "code", code: "c1" })).resolves.toBe(true);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("c1");
  });

  it("reporta fallo cuando el código no se puede canjear", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: "expired" } });

    await expect(establishRecoverySession({ kind: "code", code: "c1" })).resolves.toBe(false);
  });

  it("verifica el token_hash como recuperacion", async () => {
    await expect(establishRecoverySession({ kind: "token_hash", tokenHash: "t1" })).resolves.toBe(true);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "t1" });
  });

  it("reporta fallo cuando el token ha caducado", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: "expired" } });

    await expect(establishRecoverySession({ kind: "token_hash", tokenHash: "t1" })).resolves.toBe(false);
  });

  it("sin parametros reporta la sesión abierta si hay usuario", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    await expect(establishRecoverySession({ kind: "session" })).resolves.toBe(true);
  });

  it("sin parametros y sin usuario reporta fallo", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(establishRecoverySession({ kind: "session" })).resolves.toBe(false);
  });

  it("JWT invalido (401) reporta fallo sin lanzar, para mandar a login", async () => {
    const authError = Object.assign(new Error("invalid JWT"), { name: "AuthApiError", status: 401 });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: authError });

    await expect(establishRecoverySession({ kind: "session" })).resolves.toBe(false);
  });

  it("un 500 del servicio de auth se lanza", async () => {
    const serverError = Object.assign(new Error("internal"), { name: "AuthApiError", status: 500 });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: serverError });

    await expect(establishRecoverySession({ kind: "session" })).rejects.toBe(serverError);
  });

  it("sin sesion abierta (AuthSessionMissingError) reporta fallo sin lanzar", async () => {
    const missing = Object.assign(new Error("Auth session missing!"), { name: "AuthSessionMissingError", status: 400 });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: missing });

    await expect(establishRecoverySession({ kind: "session" })).resolves.toBe(false);
  });

  it("propaga el error de red al comprobar la sesión en vez de reportar fallo", async () => {
    const networkError = Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError" });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: networkError });

    await expect(establishRecoverySession({ kind: "session" })).rejects.toBe(networkError);
  });
});

describe("updateCurrentPassword y signOutCurrentSession", () => {
  it("actualiza la contraseña y devuelve el error si existe", async () => {
    const error = { message: "weak" };
    auth.updateUser.mockResolvedValue({ data: {}, error });

    const outcome = await updateCurrentPassword("clave-segura-1");

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "clave-segura-1" });
    expect(outcome.error).toBe(error);
  });

  it("cierra la sesión en el servidor", async () => {
    await signOutCurrentSession();

    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});
