import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  cookieMethods: undefined as
    | {
        setAll(
          cookies: Array<{
            name: string;
            value: string;
            options: { path?: string };
          }>,
          headers: Record<string, string>
        ): void;
      }
    | undefined,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (
      _url: string,
      _key: string,
      options: {
        cookies: NonNullable<typeof mocks.cookieMethods>;
      }
    ) => {
      mocks.cookieMethods = options.cookies;
      return { auth: { getClaims: mocks.getClaims } };
    }
  ),
}));

import { refreshSupabaseSession } from "./proxy";

describe("refreshSupabaseSession", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mocks.cookieMethods = undefined;
    mocks.getClaims.mockReset();
  });

  it("forwards refreshed cookies and cache headers to the request and response", async () => {
    mocks.getClaims.mockImplementation(async () => {
      mocks.cookieMethods?.setAll(
        [
          {
            name: "sb-project-auth-token",
            value: "refreshed-session",
            options: { path: "/" },
          },
        ],
        { "Cache-Control": "private, no-store" }
      );

      return {
        data: { claims: { sub: "user-1" } },
        error: null,
      };
    });

    const request = new NextRequest("http://localhost/appointments", {
      headers: {
        cookie: "sb-project-auth-token=stale-session",
      },
    });

    const result = await refreshSupabaseSession(request);

    expect(result.hasVerifiedSession).toBe(true);
    expect(request.cookies.get("sb-project-auth-token")?.value).toBe(
      "refreshed-session"
    );
    expect(
      result.response.cookies.get("sb-project-auth-token")?.value
    ).toBe("refreshed-session");
    expect(result.response.headers.get("cache-control")).toBe(
      "private, no-store"
    );
  });

  it("reports an invalid session without throwing", async () => {
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: new Error("invalid JWT"),
    });

    const request = new NextRequest("http://localhost/appointments");
    const result = await refreshSupabaseSession(request);

    expect(result.hasVerifiedSession).toBe(false);
  });
});
