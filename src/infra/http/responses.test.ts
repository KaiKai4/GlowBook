import { describe, expect, it } from "vitest";
import { binaryNoStore, jsonNoStore, noContent, redirectNoStore } from "./responses";

describe("API responses", () => {
  it("jsonNoStore sets the status, the JSON body and no-store", async () => {
    const response = jsonNoStore({ error: "No autorizado." }, 401);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "No autorizado." });
  });

  it("jsonNoStore defaults to 200", () => {
    expect(jsonNoStore({ ok: true }).status).toBe(200);
  });

  it("noContent returns 204 with no body and no-store", async () => {
    const response = noContent();

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("redirectNoStore keeps the location and adds no-store", () => {
    const response = redirectNoStore(new URL("https://app.glowbook.test/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.glowbook.test/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("binaryNoStore merges the given headers with no-store", () => {
    const response = binaryNoStore(new ArrayBuffer(2), { "Content-Type": "application/octet-stream" });

    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
