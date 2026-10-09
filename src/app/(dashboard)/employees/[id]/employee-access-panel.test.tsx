// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { EmployeeAccessPanel } from "./employee-access-panel";
import type { RoleOption } from "../types";

vi.mock("../actions", () => ({
  changeEmployeeRoleAction: vi.fn(),
  resetEmployeeAccessAction: vi.fn(),
  generateEmployeeInviteAction: vi.fn(),
}));

const ROLES: RoleOption[] = [{ id: "role-estilista", name: "Estilista" }];

describe("EmployeeAccessPanel", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el panel de acceso activo cuando el colaborador ya tiene perfil", () => {
    mounted = mountComponent(
      <EmployeeAccessPanel
        employeeId="emp-1"
        employeeEmail="ana@example.com"
        profileId="profile-1"
        currentRoleId="role-estilista"
        initialInvitation={null}
        roles={ROLES}
      />
    );

    expect(mounted.container.textContent).toContain("Acceso activo");
    expect(mounted.container.textContent).not.toContain("Generar enlace de acceso");
  });

  it("muestra el panel de invitación cuando el colaborador aún no tiene perfil", () => {
    mounted = mountComponent(
      <EmployeeAccessPanel
        employeeId="emp-2"
        employeeEmail="luis@example.com"
        profileId={null}
        currentRoleId={null}
        initialInvitation={null}
        roles={ROLES}
      />
    );

    expect(mounted.container.textContent).toContain("Generar enlace de acceso");
    expect(mounted.container.textContent).not.toContain("Acceso activo");
  });
});
