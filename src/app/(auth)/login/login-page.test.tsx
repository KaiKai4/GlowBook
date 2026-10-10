// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { flushAsync } from "@/test/ui-shared-dom";
import LoginPage from "./page";

let searchParams = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("./actions", () => ({
  signInAction: vi.fn(),
}));

describe("LoginPage", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    searchParams = new URLSearchParams("");
  });

  it("renderiza el formulario de acceso desde el shell de servidor", () => {
    mounted = mountComponent(<LoginPage />);

    expect(mounted.container.textContent).toContain("Iniciar sesión");
    expect(mounted.container.querySelector('input[autocomplete="current-password"]')).not.toBeNull();
    expect(mounted.container.textContent).not.toContain("Cuenta creada.");
  });

  it("muestra el aviso de cuenta creada cuando la URL trae joined=1", async () => {
    searchParams = new URLSearchParams("joined=1");
    mounted = mountComponent(<LoginPage />);
    await flushAsync();

    expect(mounted.container.textContent).toContain("Cuenta creada. Ingresa con tu correo y contraseña.");
  });

  it("muestra el aviso de contraseña actualizada cuando la URL trae reset=1", async () => {
    searchParams = new URLSearchParams("reset=1");
    mounted = mountComponent(<LoginPage />);
    await flushAsync();

    expect(mounted.container.textContent).toContain("Contraseña actualizada.");
  });
});
