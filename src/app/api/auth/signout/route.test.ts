import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { POST } from "./route";

vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const APP_URL = "https://app.glowbook.test/api/auth/signout";
const signOut = vi.fn();

function signoutRequest(headers: Record<string, string>) {
  return new Request(APP_URL, { method: "POST", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { signOut } } as never);
});

describe("POST /api/auth/signout: origen", () => {
  it("rechaza un Origin ajeno con 403 y no cierra la sesion (CSRF)", async () => {
    const response = await POST(signoutRequest({ origin: "https://evil.example.com" }));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Origen no permitido." });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("rechaza Origin 'null' (peticion opaca) con 403", async () => {
    const response = await POST(signoutRequest({ origin: "null" }));

    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("rechaza una peticion sin Origin ni Sec-Fetch-Site same-origin", async () => {
    const response = await POST(signoutRequest({ "sec-fetch-site": "cross-site" }));

    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("rechaza una peticion sin ninguna cabecera de origen", async () => {
    const response = await POST(signoutRequest({}));

    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("un Origin distinto del mismo host (otro puerto) tambien se rechaza", async () => {
    const response = await POST(signoutRequest({ origin: "https://app.glowbook.test:8443" }));

    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/signout: cierre de sesión", () => {
  it("cierra la sesión y redirige a /login cuando el Origin coincide", async () => {
    const response = await POST(signoutRequest({ origin: "https://app.glowbook.test" }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.glowbook.test/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("acepta una peticion sin Origin cuando Sec-Fetch-Site es same-origin", async () => {
    const response = await POST(signoutRequest({ "sec-fetch-site": "same-origin" }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe("https://app.glowbook.test/login");
  });
});
