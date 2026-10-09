import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuthUser,
  deleteAuthUser,
  findAuthUserByEmail,
  updateAuthUser,
} from "@/infra/supabase/auth-admin";
import {
  createPlatformOwnerAuthUser,
  deletePlatformOwnerAuthUser,
  findPlatformOwnerAuthUserByEmail,
  updatePlatformOwnerAuthUser,
} from "./platform-auth.repo";

// Fachada del repositorio de cuentas Auth del owner: cada funcion reenvia sus
// argumentos al adaptador admin y devuelve su respuesta sin transformarla.

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/auth-admin", () => ({
  createAuthUser: vi.fn(),
  deleteAuthUser: vi.fn(),
  findAuthUserByEmail: vi.fn(),
  updateAuthUser: vi.fn(),
}));

const mockedCreateAuthUser = vi.mocked(createAuthUser);
const mockedDeleteAuthUser = vi.mocked(deleteAuthUser);
const mockedFindAuthUserByEmail = vi.mocked(findAuthUserByEmail);
const mockedUpdateAuthUser = vi.mocked(updateAuthUser);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("platform auth repository", () => {
  it("forwards the create input and returns the adapter response untouched", async () => {
    const response = { data: null, error: null };
    mockedCreateAuthUser.mockResolvedValue(response);

    const result = await createPlatformOwnerAuthUser({
      email: "owner@example.com",
      password: "password123",
      emailConfirm: true,
    });

    expect(mockedCreateAuthUser).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "password123",
      emailConfirm: true,
    });
    expect(result).toBe(response);
  });

  it("forwards the user id to the delete adapter", async () => {
    mockedDeleteAuthUser.mockResolvedValue({ data: undefined, error: null });

    await deletePlatformOwnerAuthUser("user-1");

    expect(mockedDeleteAuthUser).toHaveBeenCalledWith("user-1");
  });

  it("looks up the owner by email through the adapter", async () => {
    mockedFindAuthUserByEmail.mockResolvedValue({ data: null, error: null });

    await findPlatformOwnerAuthUserByEmail("owner@example.com");

    expect(mockedFindAuthUserByEmail).toHaveBeenCalledWith("owner@example.com");
  });

  it("forwards the user id and the update input to the update adapter", async () => {
    mockedUpdateAuthUser.mockResolvedValue({ data: null, error: null });

    await updatePlatformOwnerAuthUser("user-1", { password: "nueva-clave", emailConfirm: true });

    expect(mockedUpdateAuthUser).toHaveBeenCalledWith("user-1", {
      password: "nueva-clave",
      emailConfirm: true,
    });
  });
});
