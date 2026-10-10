import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonAccessState, findSessionProfile } from "./session-profile.repo";

// Lectura del perfil de sesion y del estado del salon: consultas acotadas al usuario y al salon.

const hoisted = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = maybeSingle;
  return { chain, maybeSingle };
});

vi.mock("server-only", () => ({}));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: vi.fn(() => hoisted.chain) }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findSessionProfile", () => {
  it("devuelve null cuando no hay perfil para el usuario", async () => {
    hoisted.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(findSessionProfile("user-1")).resolves.toBeNull();
    expect(hoisted.chain.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("devuelve el perfil con su rol cuando existe", async () => {
    const profile = { id: "user-1", salon_id: "salon-1", is_owner: true };
    hoisted.maybeSingle.mockResolvedValue({ data: profile, error: null });

    await expect(findSessionProfile("user-1")).resolves.toEqual(profile);
  });

  it("propaga el error de la base sin convertirlo", async () => {
    const error = { message: "fallo" };
    hoisted.maybeSingle.mockResolvedValue({ data: null, error });

    await expect(findSessionProfile("user-1")).rejects.toBe(error);
  });
});

describe("findSalonAccessState", () => {
  it("devuelve null cuando el salon no existe", async () => {
    hoisted.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(findSalonAccessState("salon-1")).resolves.toBeNull();
  });

  it("devuelve el estado activo del salon", async () => {
    hoisted.maybeSingle.mockResolvedValue({ data: { id: "salon-1", is_active: true }, error: null });

    await expect(findSalonAccessState("salon-1")).resolves.toEqual({ id: "salon-1", is_active: true });
    expect(hoisted.chain.eq).toHaveBeenCalledWith("id", "salon-1");
  });

  it("propaga el error de la base", async () => {
    const error = { message: "sin acceso" };
    hoisted.maybeSingle.mockResolvedValue({ data: null, error });

    await expect(findSalonAccessState("salon-1")).rejects.toBe(error);
  });
});
