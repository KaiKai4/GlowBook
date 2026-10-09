import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import fc from "fast-check";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "./invitation-tokens";

describe("hashInvitationToken", () => {
  it("returns the sha256 hex digest of the token", () => {
    const expected = createHash("sha256").update("token-de-prueba").digest("hex");

    expect(hashInvitationToken("token-de-prueba")).toBe(expected);
    expect(hashInvitationToken("token-de-prueba")).toHaveLength(64);
  });

  it("is deterministic and sensitive to a single character change", () => {
    expect(hashInvitationToken("abc")).toBe(hashInvitationToken("abc"));
    expect(hashInvitationToken("abc")).not.toBe(hashInvitationToken("abd"));
  });

  it("rechaza el token vacio en lugar de devolver el hash de la cadena vacia", () => {
    expect(() => hashInvitationToken("")).toThrow("no puede estar vacío");
  });
});

describe("generateInvitationToken", () => {
  it("creates a 48 character lowercase hex token", () => {
    const { token } = generateInvitationToken();

    expect(token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("stores only the hash of the generated token", () => {
    const { token, tokenHash } = generateInvitationToken();

    expect(tokenHash).toBe(hashInvitationToken(token));
    expect(tokenHash).not.toBe(token);
  });

  it("produces different tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateInvitationToken().token));

    expect(tokens.size).toBe(50);
  });

  it("property: any token hashes to a 64 char hex digest, stable across calls", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (token) => {
        const digest = hashInvitationToken(token);
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
        expect(hashInvitationToken(token)).toBe(digest);
      })
    );
  });
});
