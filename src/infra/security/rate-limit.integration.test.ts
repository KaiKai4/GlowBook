import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createIntegrationAdminClient,
  getSupabaseIntegrationEnv,
} from "@/test/supabase-integration-fixtures";

// Rate limit contra la BD local real (RPC consume_rate_limit, ADR 0017). Sin
// mocks: comprueba que el contador vive en Postgres y no en memoria del proceso.

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

const admin = createIntegrationAdminClient(getSupabaseIntegrationEnv());
const usedKeys: string[] = [];

type RateLimitModule = typeof import("./rate-limit");

// Cada import tras vi.resetModules() es una "instancia" distinta del módulo:
// su propio cliente de Supabase, sin estado compartido en memoria.
async function loadRateLimitInstance(): Promise<RateLimitModule> {
  vi.resetModules();
  return import("./rate-limit");
}

function uniqueUserId(): string {
  return randomUUID();
}

function keyFor(userId: string, scope: string): string {
  const key = `user:${userId}:${scope}`;
  usedKeys.push(key);
  return key;
}

beforeEach(() => {
  vi.resetModules();
});

afterAll(async () => {
  if (usedKeys.length === 0) return;
  await admin.from("rate_limit_buckets").delete().in("key", usedKeys);
});

describe("assertActionRateLimit contra Postgres (integración)", () => {
  it("permite hasta el máximo y bloquea el intento siguiente", async () => {
    const { assertActionRateLimit } = await loadRateLimitInstance();
    const userId = uniqueUserId();
    const scope = "integration-max";
    keyFor(userId, scope);
    const options = { max: 3, windowMs: 60_000 };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(await assertActionRateLimit(userId, scope, options)).toEqual({ ok: true, value: undefined });
    }

    expect(await assertActionRateLimit(userId, scope, options)).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
  });

  it("dos instancias del módulo (clientes distintos) comparten el mismo contador", async () => {
    const instanceA = await loadRateLimitInstance();
    const instanceB = await loadRateLimitInstance();
    expect(instanceA).not.toBe(instanceB);

    const userId = uniqueUserId();
    const scope = "integration-shared";
    keyFor(userId, scope);
    const options = { max: 3, windowMs: 60_000 };

    expect((await instanceA.assertActionRateLimit(userId, scope, options)).ok).toBe(true);
    expect((await instanceA.assertActionRateLimit(userId, scope, options)).ok).toBe(true);
    expect((await instanceB.assertActionRateLimit(userId, scope, options)).ok).toBe(true);

    // Tercer slot consumido entre ambas instancias: la cuarta llamada, desde
    // cualquiera de las dos, debe bloquearse.
    expect(await instanceB.assertActionRateLimit(userId, scope, options)).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
    expect(await instanceA.assertActionRateLimit(userId, scope, options)).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
  });

  it("los contadores de usuarios o ámbitos distintos son independientes", async () => {
    const { assertActionRateLimit } = await loadRateLimitInstance();
    const userId = uniqueUserId();
    const otherUserId = uniqueUserId();
    keyFor(userId, "integration-independent-a");
    keyFor(userId, "integration-independent-b");
    keyFor(otherUserId, "integration-independent-a");
    const options = { max: 1, windowMs: 60_000 };

    expect((await assertActionRateLimit(userId, "integration-independent-a", options)).ok).toBe(true);
    expect((await assertActionRateLimit(userId, "integration-independent-a", options)).ok).toBe(false);
    expect((await assertActionRateLimit(userId, "integration-independent-b", options)).ok).toBe(true);
    expect((await assertActionRateLimit(otherUserId, "integration-independent-a", options)).ok).toBe(true);
  });

  it("la ventana expira y el usuario recupera el acceso", async () => {
    const { assertActionRateLimit } = await loadRateLimitInstance();
    const userId = uniqueUserId();
    const scope = "integration-window";
    keyFor(userId, scope);
    const options = { max: 1, windowMs: 1_000 };

    expect((await assertActionRateLimit(userId, scope, options)).ok).toBe(true);
    expect((await assertActionRateLimit(userId, scope, options)).ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    expect((await assertActionRateLimit(userId, scope, options)).ok).toBe(true);
  });
});
