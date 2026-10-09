// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, flushAsync, setFieldValue } from "@/test/ui-shared-dom";
import { createSupabaseBrowserClient } from "@/infra/supabase/client";
import ResetPasswordPage from "./page";

const pushMock = vi.fn();
let searchParams = new URLSearchParams("code=abc123");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/infra/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

interface AuthStub {
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}

function installAuth(overrides: Partial<AuthStub> = {}): AuthStub {
  const auth: AuthStub = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  vi.mocked(createSupabaseBrowserClient).mockReturnValue({ auth } as unknown as ReturnType<typeof createSupabaseBrowserClient>);
  return auth;
}

function passwordFields(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]'));
}

describe("ResetPasswordPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    pushMock.mockReset();
    searchParams = new URLSearchParams("code=abc123");
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.clearAllMocks();
  });

  it("muestra el estado de verificación mientras el enlace se valida", () => {
    installAuth({ exchangeCodeForSession: vi.fn(() => new Promise(() => undefined)) });
    mounted = mountComponent(<ResetPasswordPage />);

    expect(mounted.container.textContent).toContain("Verificando el enlace...");
  });

  it("un código de enlace que no se puede canjear muestra el enlace como inválido", async () => {
    installAuth({ exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error("expired") }) });
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    expect(mounted.container.textContent).toContain("Enlace inválido o vencido");
    expect(mounted.container.querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  it("sin parámetros y sin sesión de recuperación el enlace se marca como inválido", async () => {
    searchParams = new URLSearchParams("");
    installAuth({ getUser: vi.fn().mockResolvedValue({ data: { user: null } }) });
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    expect(mounted.container.textContent).toContain("Enlace inválido o vencido");
  });

  it("un token_hash de recuperación se verifica con OTP y habilita el formulario", async () => {
    searchParams = new URLSearchParams("token_hash=tok-1");
    const auth = installAuth();
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "tok-1" });
    expect(mounted.container.textContent).toContain("Crea tu nueva contraseña");
  });

  it("rechaza contraseñas de menos de 8 caracteres sin llamar a Supabase", async () => {
    const auth = installAuth();
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    const [password, confirm] = passwordFields(mounted.container);
    if (!password || !confirm) throw new Error("No se renderizaron los campos de contraseña");
    setFieldValue(password, "corta");
    setFieldValue(confirm, "corta");
    clickElement(requireSubmit(mounted.container));
    await flushAsync();

    expect(mounted.container.textContent).toContain("La contraseña debe tener al menos 8 caracteres.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("rechaza la confirmación distinta de la contraseña", async () => {
    const auth = installAuth();
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    const [password, confirm] = passwordFields(mounted.container);
    if (!password || !confirm) throw new Error("No se renderizaron los campos de contraseña");
    setFieldValue(password, "clave-segura-1");
    setFieldValue(confirm, "clave-segura-2");
    clickElement(requireSubmit(mounted.container));
    await flushAsync();

    expect(mounted.container.textContent).toContain("Las contraseñas no coinciden.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("con una contraseña válida la guarda, cierra la sesión de recuperación y envía a login", async () => {
    const auth = installAuth();
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    const [password, confirm] = passwordFields(mounted.container);
    if (!password || !confirm) throw new Error("No se renderizaron los campos de contraseña");
    setFieldValue(password, "clave-segura-1");
    setFieldValue(confirm, "clave-segura-1");
    clickElement(requireSubmit(mounted.container));
    await flushAsync();

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "clave-segura-1" });
    expect(auth.signOut).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/login?reset=1");
  });

  it("si Supabase rechaza la nueva contraseña muestra el error y no redirige", async () => {
    const auth = installAuth({ updateUser: vi.fn().mockResolvedValue({ error: new Error("weak") }) });
    mounted = mountComponent(<ResetPasswordPage />);
    await flushAsync();

    const [password, confirm] = passwordFields(mounted.container);
    if (!password || !confirm) throw new Error("No se renderizaron los campos de contraseña");
    setFieldValue(password, "clave-segura-1");
    setFieldValue(confirm, "clave-segura-1");
    clickElement(requireSubmit(mounted.container));
    await flushAsync();

    expect(mounted.container.textContent).toContain("No se pudo actualizar la contraseña.");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

function requireSubmit(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) throw new Error("No se encontró el botón de guardar");
  return button;
}
