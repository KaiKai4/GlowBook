// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, flushAsync, getButtonByText } from "@/test/ui-admin-dom";
import { InviteLinkReveal } from "./invite-link-reveal";

describe("InviteLinkReveal", () => {
  let mounted: MountedComponent | null = null;
  let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.useRealTimers();
  });

  it("muestra el enlace completo con el origen actual y el token", () => {
    mounted = mountComponent(<InviteLinkReveal token="tok-abc" />);

    const code = mounted.container.querySelector("code");
    expect(code?.textContent).toBe(`${window.location.origin}/invite/tok-abc`);
    expect(mounted.container.textContent).toContain("copialo ahora");
  });

  it("copia el enlace al portapapeles y muestra confirmación temporal", async () => {
    mounted = mountComponent(<InviteLinkReveal token="tok-abc" />);

    clickElement(getButtonByText(mounted.container, "Copiar"));
    await flushAsync();

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/tok-abc`);
    expect(getButtonByText(mounted.container, "Copiado")).toBeTruthy();

    vi.advanceTimersByTime(2000);
    await flushAsync();

    expect(getButtonByText(mounted.container, "Copiar")).toBeTruthy();
  });

  it("si el portapapeles rechaza la copia muestra un aviso y no marca el enlace como copiado", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    mounted = mountComponent(<InviteLinkReveal token="tok-abc" />);

    clickElement(getButtonByText(mounted.container, "Copiar"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("No se pudo copiar");
    expect(getButtonByText(mounted.container, "Copiar")).toBeTruthy();
  });
});
