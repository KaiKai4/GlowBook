import { describe, expect, it } from "vitest";
import { readBoundedText } from "./bounded-body";

describe("readBoundedText", () => {
  it("returns the full body when it fits the limit", async () => {
    const request = new Request("https://app.glowbook.test/api/x", { method: "POST", body: "hola" });

    expect(await readBoundedText(request, 16)).toBe("hola");
  });

  it("returns null when the declared Content-Length exceeds the limit", async () => {
    const request = new Request("https://app.glowbook.test/api/x", {
      method: "POST",
      headers: { "content-length": "99999" },
      body: "x",
    });

    expect(await readBoundedText(request, 16)).toBeNull();
  });

  it("returns null when the streamed body exceeds the limit without a header", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("0123456789"));
        controller.enqueue(new TextEncoder().encode("0123456789"));
        controller.close();
      },
    });
    const request = new Request("https://app.glowbook.test/api/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);

    expect(await readBoundedText(request, 15)).toBeNull();
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode("ñandú");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      },
    });
    const request = new Request("https://app.glowbook.test/api/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);

    expect(await readBoundedText(request, 64)).toBe("ñandú");
  });
});
