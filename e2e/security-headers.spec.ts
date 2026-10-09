import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { isLocalTarget, skipUnlessReady } from "./support/env";
import { readLocalFixtures } from "./support/local-fixtures";

// Cabeceras de seguridad contra la build servida (next start). Se comprueban
// en /login (público) y en una página autenticada, más los endpoints de la
// API que no deben cachearse ni aceptar orígenes ajenos.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cspNonce(csp: string | undefined): string {
  const nonce = csp === undefined ? undefined : /'nonce-([^']+)'/.exec(csp)?.[1];
  if (nonce === undefined) {
    throw new Error("La CSP debe incluir un nonce en script-src.");
  }
  return nonce;
}

function expectBaseSecurityHeaders(headers: Record<string, string>) {
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["strict-transport-security"]).toMatch(/max-age=\d+/);

  const permissions = headers["permissions-policy"];
  expect(permissions).toBeDefined();
  expect(permissions).toContain("camera=()");
  expect(permissions).toContain("microphone=()");
  expect(permissions).toContain("geolocation=()");
}

function expectStrictCsp(csp: string | undefined) {
  expect(csp, "Content-Security-Policy debe estar presente").toBeDefined();
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  cspNonce(csp);
}

async function loginAsSalonOwner(page: Page) {
  const owner = readLocalFixtures().salonOwnerA;
  await page.goto("/login");
  await page.getByLabel(/Correo|Email/i).fill(owner.email);
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(owner.password);
  await page.getByRole("button", { name: /Iniciar/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe("cabeceras de seguridad", () => {
  test.beforeEach(() => {
    skipUnlessReady(!isLocalTarget, "las cabeceras E2E requieren GLOWBOOK_TEST_TARGET=local");
  });

  test("/login responde con CSP con nonce, cabeceras estáticas y x-request-id UUID", async ({ request }) => {
    const response = await request.get("/login");
    expect(response.status()).toBe(200);

    const headers = response.headers();
    expectStrictCsp(headers["content-security-policy"]);
    expectBaseSecurityHeaders(headers);
    expect(headers["x-request-id"]).toMatch(UUID_PATTERN);
  });

  test("el nonce cambia entre peticiones y coincide con los scripts de la página", async ({ request }) => {
    const first = await request.get("/login");
    const second = await request.get("/login");

    const firstNonce = cspNonce(first.headers()["content-security-policy"]);
    const secondNonce = cspNonce(second.headers()["content-security-policy"]);
    expect(firstNonce).not.toBe(secondNonce);

    const html = await first.text();
    const scriptTags = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags.filter((value) => value.includes("src="))) {
      expect(tag).toContain(`nonce="${firstNonce}"`);
    }
  });

  test("una página autenticada conserva la CSP y las cabeceras de seguridad", async ({ page }) => {
    await loginAsSalonOwner(page);

    const response = await page.goto("/");
    if (response === null) throw new Error("La navegación a / no devolvió respuesta.");
    const headers = response.headers();
    expectStrictCsp(headers["content-security-policy"]);
    expectBaseSecurityHeaders(headers);
    expect(headers["x-request-id"]).toMatch(UUID_PATTERN);
  });

  test("x-request-id entrante válido se reutiliza y uno inválido se sustituye", async ({ request }) => {
    const incoming = "0b6f3c2e-8a4d-4e1f-9c7b-2d5e6f7a8b9c";
    const reused = await request.get("/login", { headers: { "x-request-id": incoming } });
    expect(reused.headers()["x-request-id"]).toBe(incoming);

    const replaced = await request.get("/login", { headers: { "x-request-id": "no-es-un-uuid" } });
    expect(replaced.headers()["x-request-id"]).toMatch(UUID_PATTERN);
    expect(replaced.headers()["x-request-id"]).not.toBe("no-es-un-uuid");
  });
});

test.describe("endpoints de API", () => {
  test.beforeEach(() => {
    skipUnlessReady(!isLocalTarget, "los endpoints E2E requieren GLOWBOOK_TEST_TARGET=local");
  });

  test("exportar reportes sin sesión no devuelve datos", async ({ request }) => {
    // El proxy redirige a /login antes de llegar al handler si no hay sesión:
    // sin datos, sin hoja de cálculo y con Location hacia el login.
    const response: APIResponse = await request.get("/api/reports/export", { maxRedirects: 0 });

    expect([401, 302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()["content-type"] ?? "").not.toContain("spreadsheetml");
    if (response.status() === 401) {
      expect(response.headers()["cache-control"]).toBe("no-store");
    } else {
      expect(response.headers()["location"]).toMatch(/\/login/);
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("csp-report acepta un informe válido con 204 y no-store", async ({ request }) => {
    const report = {
      "csp-report": {
        "document-uri": "http://127.0.0.1/login?token=secreto",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/payload.js",
      },
    };
    const response = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: JSON.stringify(report),
    });

    expect(response.status()).toBe(204);
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("csp-report rechaza un cuerpo gigante con 413", async ({ request }) => {
    const response = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: "x".repeat(64 * 1024),
    });

    expect([413, 400]).toContain(response.status());
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("auth/signout rechaza un Origin ajeno con 403 y no-store (sesión activa)", async ({ page }) => {
    await loginAsSalonOwner(page);

    // Con sesión el proxy deja pasar la petición y el handler comprueba el Origin.
    const response = await page.request.post("/api/auth/signout", {
      headers: { origin: "https://evil.example" },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toBe("no-store");
  });
});
