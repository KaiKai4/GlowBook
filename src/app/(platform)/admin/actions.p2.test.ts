import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/infra/auth/session";
import { deleteSalon } from "@/features/platform/use-cases/delete-salon";
import {
  inviteSalon,
  regenerateSalonInvitation,
} from "@/features/platform/use-cases/invite-salon";
import { updateSalonStatus } from "@/features/platform/use-cases/update-salon-status";
import { err, ok } from "@/infra/result";
import { formDataOf } from "@/test/action-fixtures";
import {
  deleteSalonAction,
  inviteSalonAction,
  regenerateSalonInvitationAction,
  updateSalonStatusAction,
} from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/infra/auth/session", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/features/platform/use-cases/invite-salon", () => ({
  inviteSalon: vi.fn(),
  regenerateSalonInvitation: vi.fn(),
}));
vi.mock("@/features/platform/use-cases/delete-salon", () => ({ deleteSalon: vi.fn() }));
vi.mock("@/features/platform/use-cases/update-salon-status", () => ({ updateSalonStatus: vi.fn() }));

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";
const SALON_ID = "00000000-0000-4000-8000-000000000001";
const INVITATION_ID = "00000000-0000-4000-8000-000000000002";
const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
const INVALID_ID = "Identificador inválido.";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN_ID);
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
});

describe("admin platform actions: guards", () => {
  it("propaga la redireccion de requirePlatformAdmin sin tocar casos de uso", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(inviteSalonAction(null, formDataOf({ email: "a@b.com" }))).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(inviteSalon).not.toHaveBeenCalled();
  });

  it("bloquea por rate limit con el mensaje real y clave por usuario y ambito", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const result = await inviteSalonAction(null, formDataOf({ email: "a@b.com", planId: "p" }));

    expect(result).toEqual(err(RATE_LIMIT_MESSAGE));
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: `user:${ADMIN_ID}:admin:inviteSalonAction`,
      p_max: 60,
      p_window_seconds: 60,
    });
    expect(inviteSalon).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deja pasar la accion si el almacen de rate limit falla (fail-open)", async () => {
    rpc.mockRejectedValue(new Error("db down"));
    vi.mocked(updateSalonStatus).mockResolvedValue(ok(true));

    const result = await updateSalonStatusAction(SALON_ID, true);

    expect(result).toEqual(ok(undefined));
    expect(updateSalonStatus).toHaveBeenCalledTimes(1);
  });
});

describe("inviteSalonAction", () => {
  it("invita con los datos del formulario y revalida el panel y las invitaciones", async () => {
    vi.mocked(inviteSalon).mockResolvedValue(ok("token-en-claro"));

    const result = await inviteSalonAction(
      null,
      formDataOf({ email: "dueno@salon.com", planId: "plan-1" })
    );

    expect(inviteSalon).toHaveBeenCalledWith({
      email: "dueno@salon.com",
      planId: "plan-1",
      actorUserId: ADMIN_ID,
    });
    expect(result).toEqual(ok("token-en-claro"));
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/invitations");
  });

  it("envia cadenas vacias cuando faltan campos y no revalida si falla", async () => {
    vi.mocked(inviteSalon).mockResolvedValue(err("El correo ya tiene una invitación."));

    const result = await inviteSalonAction(null, new FormData());

    expect(inviteSalon).toHaveBeenCalledWith({ email: "", planId: "", actorUserId: ADMIN_ID });
    expect(result).toEqual(err("El correo ya tiene una invitación."));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("regenerateSalonInvitationAction", () => {
  it("rechaza un identificador que no es UUID sin llamar al caso de uso", async () => {
    const result = await regenerateSalonInvitationAction("no-es-uuid");

    expect(result).toEqual(err(INVALID_ID));
    expect(regenerateSalonInvitation).not.toHaveBeenCalled();
  });

  it("regenera el enlace, devuelve el token y revalida las invitaciones", async () => {
    vi.mocked(regenerateSalonInvitation).mockResolvedValue(ok("nuevo-token"));

    const result = await regenerateSalonInvitationAction(INVITATION_ID);

    expect(regenerateSalonInvitation).toHaveBeenCalledWith({
      invitationId: INVITATION_ID,
      actorUserId: ADMIN_ID,
    });
    expect(result).toEqual(ok("nuevo-token"));
    expect(revalidatePath).toHaveBeenCalledWith("/admin/invitations");
  });

  it("no revalida cuando el caso de uso falla", async () => {
    vi.mocked(regenerateSalonInvitation).mockResolvedValue(err("Invitación no encontrada."));

    const result = await regenerateSalonInvitationAction(INVITATION_ID);

    expect(result).toEqual(err("Invitación no encontrada."));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteSalonAction", () => {
  it("rechaza un salonId invalido sin borrar nada", async () => {
    const result = await deleteSalonAction("123", "BORRAR");

    expect(result).toEqual(err(INVALID_ID));
    expect(deleteSalon).not.toHaveBeenCalled();
  });

  it("borra con la confirmacion recibida y revalida panel y salones", async () => {
    vi.mocked(deleteSalon).mockResolvedValue(ok(undefined));

    const result = await deleteSalonAction(SALON_ID, "BORRAR");

    expect(deleteSalon).toHaveBeenCalledWith({
      salonId: SALON_ID,
      confirmation: "BORRAR",
      actorUserId: ADMIN_ID,
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/salons");
  });

  it("devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(deleteSalon).mockResolvedValue(err("La confirmación no coincide."));

    const result = await deleteSalonAction(SALON_ID, "mal");

    expect(result).toEqual(err("La confirmación no coincide."));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateSalonStatusAction", () => {
  it("rechaza un salonId invalido sin cambiar el estado", async () => {
    const result = await updateSalonStatusAction("", false);

    expect(result).toEqual(err(INVALID_ID));
    expect(updateSalonStatus).not.toHaveBeenCalled();
  });

  it("cambia el estado y revalida panel, salones y auditoria", async () => {
    vi.mocked(updateSalonStatus).mockResolvedValue(ok(true));

    const result = await updateSalonStatusAction(SALON_ID, false);

    expect(updateSalonStatus).toHaveBeenCalledWith({
      salonId: SALON_ID,
      isActive: false,
      actorUserId: ADMIN_ID,
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/salons");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/audit");
  });

  it("devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(updateSalonStatus).mockResolvedValue(err("Salón no encontrado."));

    const result = await updateSalonStatusAction(SALON_ID, true);

    expect(result).toEqual(err("Salón no encontrado."));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
