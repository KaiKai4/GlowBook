import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

const URL_ = "https://app.glowbook.test/api/auth/signout";

function post(headers: Record<string, string>) {
  return new Request(URL_, { method: "POST", headers });
}

describe("isSameOriginRequest", () => {
  it("accepts a POST whose Origin matches the host", () => {
    expect(isSameOriginRequest(post({ origin: "https://app.glowbook.test" }))).toBe(true);
  });

  it("rejects a POST from another origin", () => {
    expect(isSameOriginRequest(post({ origin: "https://evil.test" }))).toBe(false);
  });

  it("rejects a different scheme or port on the same host", () => {
    expect(isSameOriginRequest(post({ origin: "http://app.glowbook.test" }))).toBe(false);
    expect(isSameOriginRequest(post({ origin: "https://app.glowbook.test:8443" }))).toBe(false);
  });

  it("rejects the opaque 'null' origin", () => {
    expect(isSameOriginRequest(post({ origin: "null" }))).toBe(false);
  });

  it("accepts a request without Origin only when Sec-Fetch-Site is same-origin", () => {
    expect(isSameOriginRequest(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(post({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("rejects a request with no origin metadata at all", () => {
    expect(isSameOriginRequest(post({}))).toBe(false);
  });
});
