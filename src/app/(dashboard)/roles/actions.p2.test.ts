import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { createRoleWithPermissions } from "@/features/access/use-cases/create-role";
import { deleteSalonRole } from "@/features/access/use-cases/delete-role";
import { updateRolePermissions } from "@/features/access/use-cases/update-role-permissions";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { createRoleAction, deleteRoleAction, updateRolePermissionsAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/access/use-cases/create-role", () => ({ createRoleWithPermissions: vi.fn() }));
vi.mock("@/features/access/use-cases/delete-role", () => ({ deleteSalonRole: vi.fn() }));
vi.mock("@/features/access/use-cases/update-role-permissions", () => ({ updateRolePermissions: vi.fn() }));

const INVALID = { ok: false, error: "Identificador inválido." } as const;
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;
const owner = buildProfile({ permissions: [PERMISSIONS.ROLES_MANAGE] });

describe("roles actions: límite, permisos e identificadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(owner);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  });

  it("niega la gestión de roles sin permiso y sin consumir límite", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.SALON_MANAGE] }));

    expect(await deleteRoleAction(RECORD_ID)).toEqual({
      ok: false,
      error: "No tienes permiso para gestionar roles.",
    });
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(deleteSalonRole).not.toHaveBeenCalled();
  });

  it("aplica 30 peticiones por minuto en el ámbito roles por usuario", async () => {
    vi.mocked(deleteSalonRole).mockResolvedValue(ok(undefined));

    await deleteRoleAction(RECORD_ID);

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "roles", { max: 30, windowMs: 60_000 });
  });

  it("devuelve el bloqueo del límite al crear un rol sin persistir", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await createRoleAction(null, formDataOf({ name: "Estilista" }))).toEqual(RATE_LIMITED);
    expect(createRoleWithPermissions).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite al actualizar permisos sin persistir", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await updateRolePermissionsAction(null, formDataOf({ role_id: RECORD_ID }))).toEqual(RATE_LIMITED);
    expect(updateRolePermissions).not.toHaveBeenCalled();
  });

  it("deleteRoleAction rechaza un roleId inválido sin borrar", async () => {
    expect(await deleteRoleAction("rol-1")).toEqual(INVALID);
    expect(deleteSalonRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deleteRoleAction borra el rol del salón y revalida la lista de roles", async () => {
    vi.mocked(deleteSalonRole).mockResolvedValue(ok(undefined));

    expect(await deleteRoleAction(RECORD_ID)).toEqual(ok(undefined));
    expect(deleteSalonRole).toHaveBeenCalledWith(SALON_ID, RECORD_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/roles");
  });
});
