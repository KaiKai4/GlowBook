import { beforeEach, describe, expect, it, vi } from "vitest";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { PERMISSIONS } from "@/infra/auth/permissions";
import { requireActiveProfile } from "@/infra/auth/session";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { err, ok } from "@/infra/result";
import { buildProfile, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { guard } from "./employee-action-guard";

vi.mock("@/infra/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  isEffectiveSalonModuleEnabled: vi.fn(),
}));

const manager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });

describe("guard de acciones de colaboradores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
  });

  it("niega sin permiso de colaboradores y no consume el límite", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.SALON_MANAGE] }));

    expect(await guard()).toEqual({
      ok: false,
      error: "No tienes permiso para gestionar colaboradores.",
    });
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(isEffectiveSalonModuleEnabled).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite de peticiones sin consultar el módulo de roles", async () => {
    const limited = err("Demasiados intentos. Espera un momento y vuelve a intentarlo.");
    vi.mocked(assertActionRateLimit).mockResolvedValue(limited);

    expect(await guard()).toEqual(limited);
    expect(isEffectiveSalonModuleEnabled).not.toHaveBeenCalled();
  });

  it("limita por usuario con 30 peticiones por minuto en el ámbito employees", async () => {
    await guard();

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "employees", { max: 30, windowMs: 60_000 });
  });

  it("devuelve el salón y reporta roles activos cuando el módulo está habilitado", async () => {
    expect(await guard()).toEqual(ok({ salonId: SALON_ID, rolesEnabled: true }));
    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(manager, "roles");
  });

  it("reporta roles deshabilitados cuando el plan o el salón los desactiva", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

    expect(await guard()).toEqual(ok({ salonId: SALON_ID, rolesEnabled: false }));
  });

  it("permite al propietario del salón sin permiso explícito", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ isOwner: true }));

    expect(await guard()).toEqual(ok({ salonId: SALON_ID, rolesEnabled: true }));
  });
});
