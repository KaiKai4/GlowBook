// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, chooseSelectOptionByCurrentText, click, flushAsync } from "@/test/ui-people-dom";
import { generateEmployeeInviteAction } from "../actions-access";
import { PendingEmployeeAccessPanel } from "./pending-employee-access-panel";
import type { PendingEmployeeInvitation, RoleOption } from "../types";

vi.mock("../actions-access", () => ({
  generateEmployeeInviteAction: vi.fn(),
}));

const ROLES: RoleOption[] = [
  { id: "role-estilista", name: "Estilista" },
  { id: "role-recepcion", name: "Recepcion" },
];

interface PanelOptions {
  employeeEmail?: string;
  initialInvitation?: PendingEmployeeInvitation | null;
  roles?: RoleOption[];
}

function renderPanel({ employeeEmail = "luis@example.com", initialInvitation = null, roles = ROLES }: PanelOptions = {}) {
  return mountComponent(
    <PendingEmployeeAccessPanel
      employeeId="emp-2"
      employeeEmail={employeeEmail}
      initialInvitation={initialInvitation}
      roles={roles}
    />
  );
}

describe("PendingEmployeeAccessPanel", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(generateEmployeeInviteAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra el correo del colaborador y el rol por defecto al unirse", () => {
    mounted = renderPanel();

    expect(mounted.container.textContent).toContain("luis@example.com");
    expect(mounted.container.querySelector('button[aria-haspopup="listbox"]')?.textContent).toContain("Estilista");
    expect(buttonWithText(mounted.container, "Generar enlace de acceso").disabled).toBe(false);
  });

  it("guía a crear roles primero cuando el salón no tiene ninguno", () => {
    mounted = renderPanel({ roles: [] });

    expect(mounted.container.textContent).toContain("No hay roles. Crea uno en Roles y Permisos primero.");
    expect(mounted.container.querySelector('button[aria-haspopup="listbox"]')).toBeNull();
  });

  it("genera el enlace con el rol elegido y lo muestra una única vez", async () => {
    vi.mocked(generateEmployeeInviteAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-new", expiresAt: "2026-10-16T00:00:00.000Z" },
    });
    mounted = renderPanel();

    chooseSelectOptionByCurrentText(mounted.container, "Estilista", "Recepcion");
    click(buttonWithText(mounted.container, "Generar enlace de acceso"));
    await flushAsync();

    expect(generateEmployeeInviteAction).toHaveBeenCalledWith("emp-2", "role-recepcion");
    expect(mounted.container.textContent).toContain("Enlace generado");
    const input = mounted.container.querySelector<HTMLInputElement>('input[aria-label="Enlace de invitación"]');
    expect(input?.value).toBe(`${window.location.origin}/join/tok-new`);
    expect(buttonWithText(mounted.container, "Regenerar enlace").textContent).toBe("Regenerar enlace");
  });

  it("envía null cuando se genera el enlace sin rol asignado", async () => {
    vi.mocked(generateEmployeeInviteAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-none", expiresAt: "2026-10-16T00:00:00.000Z" },
    });
    mounted = renderPanel();

    chooseSelectOptionByCurrentText(mounted.container, "Estilista", "Sin rol asignado");
    click(buttonWithText(mounted.container, "Generar enlace de acceso"));
    await flushAsync();

    expect(generateEmployeeInviteAction).toHaveBeenCalledWith("emp-2", null);
  });

  it("muestra el error cuando no se puede generar el enlace", async () => {
    vi.mocked(generateEmployeeInviteAction).mockResolvedValue({ ok: false, error: "El correo ya tiene una cuenta activa" });
    mounted = renderPanel();

    click(buttonWithText(mounted.container, "Generar enlace de acceso"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("El correo ya tiene una cuenta activa");
    expect(mounted.container.querySelector('input[aria-label="Enlace de invitación"]')).toBeNull();
  });

  it("indica la expiración de una invitación previa sin volver a mostrar el enlace", () => {
    const expiresAt = "2026-10-20T12:00:00.000Z";
    mounted = renderPanel({ initialInvitation: { expiresAt, roleId: "role-recepcion" } });

    const expected = new Date(expiresAt).toLocaleDateString("es-PA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    expect(mounted.container.textContent).toContain(`Hay un enlace activo que expira el ${expected}`);
    expect(mounted.container.querySelector('input[aria-label="Enlace de invitación"]')).toBeNull();
    expect(buttonWithText(mounted.container, "Regenerar enlace").textContent).toBe("Regenerar enlace");
  });

  it("regenera la invitación previa usando el rol que ya tenía", async () => {
    vi.mocked(generateEmployeeInviteAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-2", expiresAt: "2026-10-23T12:00:00.000Z" },
    });
    mounted = renderPanel({
      initialInvitation: { expiresAt: "2026-10-20T12:00:00.000Z", roleId: "role-recepcion" },
    });

    click(buttonWithText(mounted.container, "Regenerar enlace"));
    await flushAsync();

    expect(generateEmployeeInviteAction).toHaveBeenCalledWith("emp-2", "role-recepcion");
  });

  it("una invitación sin rol previo se regenera sin rol, no con el primer rol del salón", async () => {
    vi.mocked(generateEmployeeInviteAction).mockResolvedValue({
      ok: true,
      value: { token: "tok-3", expiresAt: "2026-10-23T12:00:00.000Z" },
    });
    mounted = renderPanel({
      initialInvitation: { expiresAt: "2026-10-20T12:00:00.000Z", roleId: null },
    });

    click(buttonWithText(mounted.container, "Regenerar enlace"));
    await flushAsync();

    expect(generateEmployeeInviteAction).toHaveBeenCalledWith("emp-2", null);
  });

  it("sin email registrado no permite generar el enlace y avisa al usuario", () => {
    mounted = renderPanel({ employeeEmail: "" });

    expect(mounted.container.textContent).toContain("Correo:");
    expect(mounted.container.textContent).toContain("Sin email registrado. Edita el colaborador primero.");
    expect(buttonWithText(mounted.container, "Generar enlace de acceso").disabled).toBe(true);
  });
});
