// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, flushAsync } from "@/test/ui-people-dom";
import { EmployeeInviteLinkCard } from "./employee-invite-link-card";

const INVITE_URL = "https://glowbook.test/join/tok-xyz";

describe("EmployeeInviteLinkCard (copia y selección)", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("selecciona todo el enlace al hacer clic en el campo para copiarlo a mano", () => {
    mounted = mountComponent(<EmployeeInviteLinkCard url={INVITE_URL} />);
    const input = mounted.container.querySelector<HTMLInputElement>('input[aria-label="Enlace de invitación"]');
    if (!input) throw new Error("falta el campo del enlace");
    const select = vi.spyOn(input, "select");

    click(input);

    expect(select).toHaveBeenCalledTimes(1);
    expect(input.readOnly).toBe(true);
  });

  it("vuelve al texto Copiar tras dos segundos de haber copiado", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mounted = mountComponent(<EmployeeInviteLinkCard url={INVITE_URL} />);

    click(buttonWithText(mounted.container, "Copiar"));
    await flushAsync();
    expect(buttonWithText(mounted.container, "Copiado").textContent).toBe("Copiado");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(buttonWithText(mounted.container, "Copiar").textContent).toBe("Copiar");
  });

  it("muestra la fecha de expiración en español junto al título", () => {
    mounted = mountComponent(
      <EmployeeInviteLinkCard url={INVITE_URL} title="Enlace nuevo" expiresAt="2026-10-16T12:00:00.000Z" />
    );

    const expected = new Date("2026-10-16T12:00:00.000Z").toLocaleDateString("es-PA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    expect(mounted.container.textContent).toContain(`Enlace nuevo - expira el ${expected}`);
  });
});
