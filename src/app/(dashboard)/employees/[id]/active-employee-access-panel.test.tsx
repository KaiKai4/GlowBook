// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buttonWithText,
  chooseSelectOptionByCurrentText,
  click,
  flushAsync,
} from "@/test/ui-people-dom";
import { changeEmployeeRoleAction, resetEmployeeAccessAction } from "../actions";
import { ActiveEmployeeAccessPanel } from "./active-employee-access-panel";
import type { RoleOption } from "../types";

vi.mock("../actions", () => ({
  changeEmployeeRoleAction: vi.fn(),
  resetEmployeeAccessAction: vi.fn(),
}));

const ROLES: RoleOption[] = [
  { id: "role-estilista", name: "Estilista" },
  { id: "role-recepcion", name: "Recepcion" },
];

function renderPanel(overrides: Partial<Parameters<typeof ActiveEmployeeAccessPanel>[0]> = {}): MountedComponent {
  return mountComponent(
    <ActiveEmployeeAccessPanel
      employeeId="emp-1"
      employeeEmail="ana@example.com"
      profileId="profile-1"
      currentRoleId="role-estilista"
      roles={ROLES}
      {...overrides}
    />
  );
}

function guardarButton(container: HTMLElement): HTMLButtonElement {
  return buttonWithText(container, "Guardar");
}

describe("ActiveEmployeeAccessPanel", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(changeEmployeeRoleAction).mockReset();
    vi.mocked(resetEmployeeAccessAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("indica el acceso activo y muestra el rol actual seleccionado", () => {
    mounted = renderPanel();

    expect(mounted.container.textContent).toContain("Acceso activo");
    expect(mounted.container.querySelector('button[aria-haspopup="listbox"]')?.textContent).toContain("Estilista");
  });

  it("deshabilita Guardar mientras el rol no cambia", () => {
    mounted = renderPanel();

    expect(guardarButton(mounted.container).disabled).toBe(true);
  });

  it("guarda el nuevo rol del perfil y habilita Guardar solo cuando hay cambios", async () => {
    vi.mocked(changeEmployeeRoleAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderPanel();

    chooseSelectOptionByCurrentText(mounted.container, "Estilista", "Recepcion");
    expect(guardarButton(mounted.container).disabled).toBe(false);
    click(guardarButton(mounted.container));
    await flushAsync();

    expect(changeEmployeeRoleAction).toHaveBeenCalledWith("profile-1", "role-recepcion");
  });

  it("envía null cuando el usuario elige Sin rol", async () => {
    vi.mocked(changeEmployeeRoleAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderPanel();

    chooseSelectOptionByCurrentText(mounted.container, "Estilista", "Sin rol");
    click(guardarButton(mounted.container));
    await flushAsync();

    expect(changeEmployeeRoleAction).toHaveBeenCalledWith("profile-1", null);
  });

  it("muestra el error cuando no se puede cambiar el rol", async () => {
    vi.mocked(changeEmployeeRoleAction).mockResolvedValue({ ok: false, error: "No tienes permiso para asignar ese rol" });
    mounted = renderPanel();

    chooseSelectOptionByCurrentText(mounted.container, "Estilista", "Recepcion");
    click(guardarButton(mounted.container));
    await flushAsync();

    expect(mounted.container.textContent).toContain("No tienes permiso para asignar ese rol");
  });

  it("reinicia el acceso con el rol actual y muestra el nuevo enlace una sola vez", async () => {
    vi.mocked(resetEmployeeAccessAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-reset", expiresAt: "2026-10-16T00:00:00.000Z" },
    });
    mounted = renderPanel();

    click(buttonWithText(mounted.container, "Reiniciar y generar enlace"));
    await flushAsync();

    expect(resetEmployeeAccessAction).toHaveBeenCalledWith("emp-1", "role-estilista");
    expect(mounted.container.textContent).toContain("Nuevo enlace generado");
    const input = mounted.container.querySelector<HTMLInputElement>('input[aria-label="Enlace de invitación"]');
    expect(input?.value).toBe(`${window.location.origin}/join/tok-reset`);
  });

  it("al reiniciar con Sin rol envía null y no reutiliza el rol previo", async () => {
    vi.mocked(resetEmployeeAccessAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-reset", expiresAt: "2026-10-16T00:00:00.000Z" },
    });
    mounted = renderPanel();

    chooseSelectOptionByCurrentText(mounted.container, "Estilista", "Sin rol");
    click(buttonWithText(mounted.container, "Reiniciar y generar enlace"));
    await flushAsync();

    expect(resetEmployeeAccessAction).toHaveBeenCalledWith("emp-1", null);
  });

  it("muestra el error cuando el reinicio de acceso falla", async () => {
    vi.mocked(resetEmployeeAccessAction).mockResolvedValue({ ok: false, error: "La cuenta ya no existe" });
    mounted = renderPanel();

    click(buttonWithText(mounted.container, "Reiniciar y generar enlace"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("La cuenta ya no existe");
    expect(mounted.container.querySelector('input[aria-label="Enlace de invitación"]')).toBeNull();
  });

  it("muestra los avisos devueltos al reiniciar el acceso junto al enlace nuevo", async () => {
    vi.mocked(resetEmployeeAccessAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-reset", expiresAt: "2026-10-16T00:00:00.000Z" },
      warnings: ["El plan no permite más profesionales.", "Revisa el rol asignado."],
    });
    mounted = renderPanel();

    click(buttonWithText(mounted.container, "Reiniciar y generar enlace"));
    await flushAsync();

    expect(mounted.container.textContent).toContain(
      "El plan no permite más profesionales. Revisa el rol asignado."
    );
    expect(mounted.container.textContent).toContain("Nuevo enlace generado");
  });

  it("no muestra aviso cuando el reinicio no devuelve advertencias", async () => {
    vi.mocked(resetEmployeeAccessAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-reset", expiresAt: "2026-10-16T00:00:00.000Z" },
      warnings: [],
    });
    mounted = renderPanel();

    click(buttonWithText(mounted.container, "Reiniciar y generar enlace"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("Nuevo enlace generado");
    expect(mounted.container.textContent).not.toContain("El plan no permite");
    expect(mounted.container.querySelector(".text-warning-strong.rounded-lg")).toBeNull();
  });

  it("no permite reiniciar el acceso cuando el colaborador no tiene email", () => {
    mounted = renderPanel({ employeeEmail: "" });

    expect(buttonWithText(mounted.container, "Reiniciar y generar enlace").disabled).toBe(true);
  });
});
