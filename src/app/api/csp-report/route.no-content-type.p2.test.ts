import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/csp-report sin cabecera Content-Type", () => {
  it("responde 415 sin caché cuando el informe no declara tipo de contenido", async () => {
    const response = await POST(new Request("http://localhost/api/csp-report", { method: "POST" }));

    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Tipo de contenido no soportado." });
  });
});
