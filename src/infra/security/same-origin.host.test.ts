import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

// Next construye request.url con "localhost" en next start/dev aunque el navegador
// use 127.0.0.1: el origen esperado debe salir del Host real de la petición.

function post(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

describe("isSameOriginRequest con el host real de la petición", () => {
  it("acepta el Origin del host por el que llegó la petición aunque request.url diga localhost", () => {
    const request = post("http://localhost:3100/api/auth/signout", {
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3100",
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rechaza un Origin ajeno aunque el Host sea el nuestro", () => {
    const request = post("http://localhost:3100/api/auth/signout", {
      host: "127.0.0.1:3100",
      origin: "https://evil.example",
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("usa x-forwarded-host y x-forwarded-proto cuando el proxy los informa", () => {
    const request = post("http://localhost:3000/api/auth/signout", {
      host: "localhost:3000",
      "x-forwarded-host": "app.glowbook.test",
      "x-forwarded-proto": "https",
      origin: "https://app.glowbook.test",
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rechaza un esquema distinto al informado por x-forwarded-proto", () => {
    const request = post("http://localhost:3000/api/auth/signout", {
      host: "localhost:3000",
      "x-forwarded-host": "app.glowbook.test",
      "x-forwarded-proto": "https",
      origin: "http://app.glowbook.test",
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });
});
