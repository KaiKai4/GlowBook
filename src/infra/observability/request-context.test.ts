import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestId } from "./request-context";

const headersMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

const VALID = "3f2c1a9e-5b7d-4c8e-9a0b-1d2e3f4a5b6c";

describe("getRequestId", () => {
  beforeEach(() => {
    headersMock.mockReset();
  });

  it("returns the valid request id of the current request", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-request-id": VALID }));

    expect(await getRequestId()).toBe(VALID);
  });

  it("returns undefined when the header is missing or invalid", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-request-id": "basura" }));
    expect(await getRequestId()).toBeUndefined();

    headersMock.mockResolvedValue(new Headers());
    expect(await getRequestId()).toBeUndefined();
  });

  it("returns undefined outside a request scope", async () => {
    headersMock.mockRejectedValue(new Error("headers was called outside a request scope"));

    expect(await getRequestId()).toBeUndefined();
  });

  it("rethrows Next control-flow signals that carry a digest", async () => {
    const signal = Object.assign(new Error("dynamic usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    headersMock.mockRejectedValue(signal);

    await expect(getRequestId()).rejects.toBe(signal);
  });
});
