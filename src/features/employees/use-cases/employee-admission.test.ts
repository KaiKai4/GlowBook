import { describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "@/infra/result";
import { admitNewEmployee } from "./employee-admission";

type EmployeeAdmissionChecks = Parameters<typeof admitNewEmployee>[0]["checks"];

const ROLE_ID = "6d7e8f90-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

function checks(overrides: Partial<Record<keyof EmployeeAdmissionChecks, Result<void>>> = {}) {
  const pass = (): Promise<Result<void>> => Promise.resolve(ok(undefined));
  const fns: EmployeeAdmissionChecks = {
    checkModuleAccess: vi.fn(overrides.checkModuleAccess ? () => Promise.resolve(overrides.checkModuleAccess!) : pass),
    checkActiveLimit: vi.fn(overrides.checkActiveLimit ? () => Promise.resolve(overrides.checkActiveLimit!) : pass),
    checkLoginLimit: vi.fn(overrides.checkLoginLimit ? () => Promise.resolve(overrides.checkLoginLimit!) : pass),
  };
  return fns;
}

describe("admitNewEmployee", () => {
  it("sin rol pedido admite el alta sin rol y no consulta el cupo de login", async () => {
    const c = checks();

    const result = await admitNewEmployee({ rolesEnabled: true, requestedRoleId: null, checks: c });

    expect(result).toEqual(ok({ roleId: null }));
    expect(c.checkLoginLimit).not.toHaveBeenCalled();
  });

  it("con rol y roles habilitados conserva el rol y consume el cupo de login", async () => {
    const c = checks();

    const result = await admitNewEmployee({ rolesEnabled: true, requestedRoleId: ` ${ROLE_ID} `, checks: c });

    expect(result).toEqual(ok({ roleId: ROLE_ID }));
    expect(c.checkLoginLimit).toHaveBeenCalledOnce();
  });

  it("con roles deshabilitados descarta el rol y no consume el cupo de login", async () => {
    const c = checks();

    const result = await admitNewEmployee({ rolesEnabled: false, requestedRoleId: ROLE_ID, checks: c });

    expect(result).toEqual(ok({ roleId: null }));
    expect(c.checkLoginLimit).not.toHaveBeenCalled();
  });

  it("un rol formado solo por espacios cuenta como sin rol", async () => {
    const result = await admitNewEmployee({ rolesEnabled: true, requestedRoleId: "   ", checks: checks() });

    expect(result).toEqual(ok({ roleId: null }));
  });

  it("si el modulo no esta en el plan se corta antes de mirar los cupos", async () => {
    const c = checks({ checkModuleAccess: err("Tu plan no incluye colaboradores.") });

    const result = await admitNewEmployee({ rolesEnabled: true, requestedRoleId: ROLE_ID, checks: c });

    expect(result).toEqual(err("Tu plan no incluye colaboradores."));
    expect(c.checkActiveLimit).not.toHaveBeenCalled();
    expect(c.checkLoginLimit).not.toHaveBeenCalled();
  });

  it("si se alcanza el cupo de colaboradores activos se corta antes del cupo de login", async () => {
    const c = checks({ checkActiveLimit: err("Llegaste al límite de colaboradores.") });

    const result = await admitNewEmployee({ rolesEnabled: true, requestedRoleId: ROLE_ID, checks: c });

    expect(result).toEqual(err("Llegaste al límite de colaboradores."));
    expect(c.checkLoginLimit).not.toHaveBeenCalled();
  });

  it("si se alcanza el cupo de usuarios con login el alta con rol se rechaza", async () => {
    const c = checks({ checkLoginLimit: err("Llegaste al límite de usuarios con acceso.") });

    const result = await admitNewEmployee({ rolesEnabled: true, requestedRoleId: ROLE_ID, checks: c });

    expect(result).toEqual(err("Llegaste al límite de usuarios con acceso."));
  });

  it("el cupo de login no bloquea un alta sin rol aunque este agotado", async () => {
    const c = checks({ checkLoginLimit: err("Llegaste al límite de usuarios con acceso.") });

    const result = await admitNewEmployee({ rolesEnabled: true, requestedRoleId: null, checks: c });

    expect(result).toEqual(ok({ roleId: null }));
  });
});
