import { describe, expect, it, vi } from "vitest";
import { setSupabaseServerCookies } from "./cookies";

const cookie = {
  name: "sb-project-auth-token",
  value: "refreshed-session",
  options: { path: "/" },
};

describe("setSupabaseServerCookies", () => {
  it("ignores Next.js read-only cookie writes during Server Component rendering", () => {
    const set = vi.fn(() => {
      throw new Error(
        "Cookies can only be modified in a Server Action or Route Handler."
      );
    });

    expect(() =>
      setSupabaseServerCookies({ set }, [cookie])
    ).not.toThrow();
  });

  it("does not hide unrelated cookie failures", () => {
    const set = vi.fn(() => {
      throw new Error("cookie storage unavailable");
    });

    expect(() => setSupabaseServerCookies({ set }, [cookie])).toThrow(
      "cookie storage unavailable"
    );
  });
});
