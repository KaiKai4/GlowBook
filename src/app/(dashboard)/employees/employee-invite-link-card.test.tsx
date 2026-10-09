// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { EmployeeInviteLinkCard } from "./employee-invite-link-card";

const INVITE_URL = "https://glowbook.test/invite/abc123";

describe("EmployeeInviteLinkCard", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  it("muestra el enlace y el título por defecto sin descripción ni vencimiento", () => {
    mounted = mountComponent(<EmployeeInviteLinkCard url={INVITE_URL} />);

    const input = mounted.container.querySelector<HTMLInputElement>('input[aria-label="Enlace de invitación"]');
    expect(input?.value).toBe(INVITE_URL);
    expect(mounted.container.textContent).toContain("Enlace de acceso");
    expect(mounted.container.textContent).not.toContain("expira el");
    expect(mounted.container.querySelector("p.text-fg-subtle")).toBeNull();
  });

  it("muestra la descripción cuando se indica", () => {
    mounted = mountComponent(
      <EmployeeInviteLinkCard url={INVITE_URL} title="Acceso de Marta" description="Válido para un solo uso." />
    );

    expect(mounted.container.textContent).toContain("Acceso de Marta");
    expect(mounted.container.textContent).toContain("Válido para un solo uso.");
  });

  it("indica la fecha de expiración en español cuando se conoce", () => {
    mounted = mountComponent(<EmployeeInviteLinkCard url={INVITE_URL} expiresAt="2026-06-15T12:00:00.000Z" />);

    expect(mounted.container.textContent).toContain("expira el");
    expect(mounted.container.textContent).toContain("2026");
  });

  it("copia el enlace al portapapeles y confirma el cambio en el botón", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mounted = mountComponent(<EmployeeInviteLinkCard url={INVITE_URL} />);

    const button = mounted.container.querySelector("button");
    expect(button?.textContent).toBe("Copiar");

    await act(async () => {
      button?.click();
    });

    expect(writeText).toHaveBeenCalledWith(INVITE_URL);
    expect(mounted.container.querySelector("button")?.textContent).toBe("Copiado");
  });
});
