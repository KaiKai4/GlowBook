import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@supabase/supabase-js";
import { createAuthUser, deleteAuthUser } from "@/infra/supabase/auth-admin";
import { createEmployeeAuthUser, deleteEmployeeAuthUser } from "./employee-auth.repo";

// Adaptador delgado sobre el admin de Auth: debe reenviar exactamente los
// argumentos y devolver la respuesta sin reinterpretarla.

vi.mock("@/infra/supabase/auth-admin", () => ({
  createAuthUser: vi.fn(),
  deleteAuthUser: vi.fn(),
}));

const mockedCreateAuthUser = vi.mocked(createAuthUser);
const mockedDeleteAuthUser = vi.mocked(deleteAuthUser);

describe("employee auth repo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("createEmployeeAuthUser reenvía la entrada y devuelve la respuesta de Auth", async () => {
    const response = { data: null, error: null };
    mockedCreateAuthUser.mockResolvedValue(response);
    const input = { email: "ana@salon.test", password: "clave-segura-1", emailConfirm: true };

    await expect(createEmployeeAuthUser(input)).resolves.toBe(response);
    expect(mockedCreateAuthUser).toHaveBeenCalledWith(input);
  });

  it("createEmployeeAuthUser devuelve el error de Auth sin transformarlo", async () => {
    const response = { data: null, error: new AuthError("ya registrado", 422) };
    mockedCreateAuthUser.mockResolvedValue(response);

    await expect(
      createEmployeeAuthUser({ email: "ana@salon.test", password: "clave-segura-1" })
    ).resolves.toBe(response);
  });

  it("deleteEmployeeAuthUser reenvía el id del usuario y devuelve la respuesta", async () => {
    const response = { data: undefined, error: null };
    mockedDeleteAuthUser.mockResolvedValue(response);

    await expect(deleteEmployeeAuthUser("user-1")).resolves.toBe(response);
    expect(mockedDeleteAuthUser).toHaveBeenCalledWith("user-1");
  });
});
