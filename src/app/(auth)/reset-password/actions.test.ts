import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";
import {
  establishRecoverySession,
  signOutCurrentSession,
  updateCurrentPassword,
} from "@/infra/auth/password-auth";
import { err, ok } from "@/infra/result";
import { updatePasswordAction, verifyRecoveryLinkAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/security/rate-limit", () => ({ assertAnonymousRateLimit: vi.fn() }));
vi.mock("@/infra/auth/password-auth", () => ({
  establishRecoverySession: vi.fn(),
  updateCurrentPassword: vi.fn(),
  signOutCurrentSession: vi.fn(),
}));

const UPDATE_ERROR = "No se pudo actualizar la contraseña. Pide un enlace nuevo e intentalo otra vez.";

beforeEach(() => {
  vi.mocked(assertAnonymousRateLimit).mockResolvedValue(ok(undefined));
  vi.clearAllMocks();
  vi.mocked(establishRecoverySession).mockResolvedValue(true);
  vi.mocked(updateCurrentPassword).mockResolvedValue({ error: null });
  vi.mocked(signOutCurrentSession).mockResolvedValue(undefined);
});

describe("verifyRecoveryLinkAction", () => {
  it("canjea el codigo PKCE cuando viene en el enlace", async () => {
    const valid = await verifyRecoveryLinkAction({ code: "abc", tokenHash: "xyz" });

    expect(establishRecoverySession).toHaveBeenCalledWith({ kind: "code", code: "abc" });
    expect(valid).toBe(true);
  });

  it("verifica el token_hash de recuperacion cuando no hay codigo", async () => {
    await verifyRecoveryLinkAction({ code: null, tokenHash: "tok-1" });

    expect(establishRecoverySession).toHaveBeenCalledWith({ kind: "token_hash", tokenHash: "tok-1" });
  });

  it("sin parametros consulta la sesion de recuperacion ya abierta", async () => {
    await verifyRecoveryLinkAction({ code: null, tokenHash: null });

    expect(establishRecoverySession).toHaveBeenCalledWith({ kind: "session" });
  });

  it("un enlace caducado o invalido devuelve false", async () => {
    vi.mocked(establishRecoverySession).mockResolvedValue(false);

    const valid = await verifyRecoveryLinkAction({ code: "caducado", tokenHash: null });

    expect(valid).toBe(false);
  });

  it("una cadena vacia en code no cuenta como codigo", async () => {
    await verifyRecoveryLinkAction({ code: "", tokenHash: "tok-2" });

    expect(establishRecoverySession).toHaveBeenCalledWith({ kind: "token_hash", tokenHash: "tok-2" });
  });
});

describe("updatePasswordAction", () => {
  it("rechaza contraseñas de menos de 8 caracteres sin tocar Supabase", async () => {
    const result = await updatePasswordAction("corta");

    expect(result).toEqual(err("La contraseña debe tener al menos 8 caracteres."));
    expect(updateCurrentPassword).not.toHaveBeenCalled();
    expect(signOutCurrentSession).not.toHaveBeenCalled();
  });

  it("guarda la contraseña y cierra la sesion de recuperacion", async () => {
    const result = await updatePasswordAction("clave-segura-1");

    expect(updateCurrentPassword).toHaveBeenCalledWith("clave-segura-1");
    expect(signOutCurrentSession).toHaveBeenCalledOnce();
    expect(result).toEqual(ok(undefined));
  });

  it("si Supabase rechaza el cambio devuelve el error sin cerrar sesion", async () => {
    vi.mocked(updateCurrentPassword).mockResolvedValue({ error: { message: "weak" } as never });

    const result = await updatePasswordAction("clave-segura-1");

    expect(result).toEqual(err(UPDATE_ERROR));
    expect(signOutCurrentSession).not.toHaveBeenCalled();
  });

  it("un enlace caducado (sin sesion) tambien devuelve el error de actualizacion", async () => {
    vi.mocked(updateCurrentPassword).mockResolvedValue({ error: { code: "session_not_found" } as never });

    const result = await updatePasswordAction("clave-segura-1");

    expect(result).toEqual(err(UPDATE_ERROR));
  });
});

describe("acciones de recuperacion con limite por IP", () => {
  it("un enlace bloqueado por el limite cuenta como no valido sin validarlo", async () => {
    vi.mocked(assertAnonymousRateLimit).mockResolvedValue(err("Demasiados intentos. Espera un momento y vuelve a intentarlo."));

    await expect(verifyRecoveryLinkAction({ code: "c-1", tokenHash: null })).resolves.toBe(false);
    expect(establishRecoverySession).not.toHaveBeenCalled();
  });

  it("una contrasena bloqueada por el limite no se cambia", async () => {
    vi.mocked(assertAnonymousRateLimit).mockResolvedValue(err("Demasiados intentos. Espera un momento y vuelve a intentarlo."));

    const result = await updatePasswordAction("clave-nueva-1");

    expect(result.ok).toBe(false);
    expect(updateCurrentPassword).not.toHaveBeenCalled();
  });
});
