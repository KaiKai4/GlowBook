import { describe, expect, it, vi } from "vitest";
import { isAuthInfrastructureError } from "./session";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

describe("isAuthInfrastructureError", () => {
  it("sin error no es un fallo de infraestructura", () => {
    expect(isAuthInfrastructureError(null)).toBe(false);
  });

  it("un error sin estado HTTP (red caida) es de infraestructura", () => {
    expect(isAuthInfrastructureError({ name: "AuthUnknownError" })).toBe(true);
  });

  it("un estado 0 es de infraestructura", () => {
    expect(isAuthInfrastructureError({ name: "AuthUnknownError", status: 0 })).toBe(true);
  });

  it("un 4xx del cliente no es de infraestructura", () => {
    expect(isAuthInfrastructureError({ name: "AuthApiError", status: 401 })).toBe(false);
  });
});
