import { describe, expect, it } from "vitest";
import { issuePlatformAdminProof, type PlatformAdminProof } from "./platform-admin-proof";

describe("issuePlatformAdminProof", () => {
  it("la prueba expone el id del usuario verificado", () => {
    const proof: PlatformAdminProof = issuePlatformAdminProof("admin-1");

    expect(proof.userId).toBe("admin-1");
  });

  it("cada emisión devuelve una prueba nueva para el mismo usuario", () => {
    const first = issuePlatformAdminProof("admin-1");
    const second = issuePlatformAdminProof("admin-1");

    expect(first).not.toBe(second);
    expect(second.userId).toBe(first.userId);
  });
});
