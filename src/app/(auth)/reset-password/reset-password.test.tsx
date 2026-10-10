// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, flushAsync, setFieldValue } from "@/test/ui-shared-dom";
import { err, ok } from "@/infra/result";
import ResetPasswordPage from "./page";
import { updatePasswordAction, verifyRecoveryLinkAction } from "./actions";

const pushMock = vi.fn();
let searchParams = new URLSearchParams("code=abc123");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParams,
}));

vi.mock("./actions", () => ({
  verifyRecoveryLinkAction: vi.fn(),
  updatePasswordAction: vi.fn(),
}));

function passwordFields(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]'));
}

function requireSubmit(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) throw new Error("No se encontró el botón de guardar");
  return button;
}

async function fillAndSubmit(container: HTMLElement, password: string, confirm: string) {
  const [passwordInput, confirmInput] = passwordFields(container);
  if (!passwordInput || !confirmInput) throw new Error("No se renderizaron los campos de contraseña");
  setFieldValue(passwordInput, password);
  setFieldValue(confirmInput, confirm);
  clickElement(requireSubmit(container));
  await flushAsync();
}

describe("ResetPasswordPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    pushMock.mockReset();
    searchParams = new URLSearchParams("code=abc123");
    vi.mocked(verifyRecoveryLinkAction).mockResolvedValue(true);
    vi.mocked(updatePasswordAction).mockResolvedValue(ok(undefined));
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.clearAllMocks();
  });

  it("muestra el estado de verificación mientras el enlace se válida", () => {
    vi.mocked(verifyRecoveryLinkAction).mockReturnValue(new Promise(() => undefined));
    mounted = mountComponent(<ResetPasswordPage />);

    expect(mounted.container.textContent).toContain("Verificando el enlace...");
  });

  it("pasa el código del enlace a la verificación del servidor", async () => {
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    expect(verifyRecoveryLinkAction).toHaveBeenCalledWith({ code: "abc123", tokenHash: null });
  });

  it("un enlace que no se puede canjear muestra el enlace como inválido", async () => {
    vi.mocked(verifyRecoveryLinkAction).mockResolvedValue(false);
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    expect(mounted.container.textContent).toContain("Enlace inválido o vencido");
    expect(mounted.container.querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  it("sin parámetros se consulta la sesión de recuperación abierta", async () => {
    searchParams = new URLSearchParams("");
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    expect(verifyRecoveryLinkAction).toHaveBeenCalledWith({ code: null, tokenHash: null });
  });

  it("un token_hash de recuperación se envía a verificar y habilita el formulario", async () => {
    searchParams = new URLSearchParams("token_hash=tok-1");
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    expect(verifyRecoveryLinkAction).toHaveBeenCalledWith({ code: null, tokenHash: "tok-1" });
    expect(mounted.container.textContent).toContain("Crea tu nueva contraseña");
  });

  it("rechaza contraseñas de menos de 8 caracteres sin llamar al servidor", async () => {
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    await fillAndSubmit(mounted.container, "corta", "corta");

    expect(mounted.container.textContent).toContain("La contraseña debe tener al menos 8 caracteres.");
    expect(updatePasswordAction).not.toHaveBeenCalled();
  });

  it("rechaza la confirmación distinta de la contraseña", async () => {
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    await fillAndSubmit(mounted.container, "clave-segura-1", "clave-segura-2");

    expect(mounted.container.textContent).toContain("Las contraseñas no coinciden.");
    expect(updatePasswordAction).not.toHaveBeenCalled();
  });

  it("con una contraseña válida la guarda y envía a login", async () => {
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    await fillAndSubmit(mounted.container, "clave-segura-1", "clave-segura-1");

    expect(updatePasswordAction).toHaveBeenCalledWith("clave-segura-1");
    expect(pushMock).toHaveBeenCalledWith("/login?reset=1");
  });

  it("si el servidor rechaza la nueva contraseña muestra el error y no redirige", async () => {
    vi.mocked(updatePasswordAction).mockResolvedValue(
      err("No se pudo actualizar la contraseña. Pide un enlace nuevo e intentalo otra vez.")
    );
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    await fillAndSubmit(mounted.container, "clave-segura-1", "clave-segura-1");

    expect(mounted.container.textContent).toContain("No se pudo actualizar la contraseña.");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
