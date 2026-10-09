// Pruebas del runner de procesos del verificador (node:test).
// Cubren la lógica pura (argumentos de taskkill, clasificación) y el
// comportamiento real: fin correcto, fallo, timeout y terminación del árbol.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyRunResult,
  killProcessTree,
  runArgvWithTimeout,
  taskkillArgs,
} from "./lib-process.mjs";

/**
 * Espera (hasta 5 s) a que un pid deje de existir.
 * @param {number} pid
 * @returns {Promise<boolean>} true si ya no existe
 */
async function waitUntilGone(pid) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

describe("taskkillArgs", () => {
  it("usa /T para terminar el árbol y /F para forzar", () => {
    assert.deepEqual(taskkillArgs(1234), ["/PID", "1234", "/T", "/F"]);
  });
});

describe("classifyRunResult", () => {
  it("un timeout gana siempre, aunque el código sea 0", () => {
    assert.equal(classifyRunResult({ timedOut: true, status: 0, error: null }), "timeout");
    assert.equal(classifyRunResult({ timedOut: true, status: null, error: null }), "timeout");
  });

  it("código 0 sin error es ok", () => {
    assert.equal(classifyRunResult({ timedOut: false, status: 0, error: null }), "ok");
  });

  it("código distinto de 0, error de arranque o señal sin código es fail", () => {
    assert.equal(classifyRunResult({ timedOut: false, status: 1, error: null }), "fail");
    assert.equal(
      classifyRunResult({ timedOut: false, status: null, error: new Error("ENOENT") }),
      "fail"
    );
    assert.equal(classifyRunResult({ timedOut: false, status: null, error: null }), "fail");
  });
});

describe("killProcessTree", () => {
  it("rechaza pids inválidos sin tocar ningún proceso", () => {
    assert.equal(killProcessTree(undefined), false);
    assert.equal(killProcessTree(0), false);
    assert.equal(killProcessTree(-5), false);
    assert.equal(killProcessTree(1.5), false);
  });
});

describe("runArgvWithTimeout", () => {
  it("devuelve el código de salida de un proceso que termina a tiempo", async () => {
    const result = await runArgvWithTimeout(["node", "-e", "process.exit(0)"], {
      timeoutMs: 30000,
    });
    assert.deepEqual(result, { status: 0, timedOut: false, error: null });
    assert.equal(classifyRunResult(result), "ok");
  });

  it("propaga un código de fallo sin marcarlo como timeout", async () => {
    const result = await runArgvWithTimeout(["node", "-e", "process.exit(3)"], {
      timeoutMs: 30000,
    });
    assert.equal(result.status, 3);
    assert.equal(result.timedOut, false);
    assert.equal(classifyRunResult(result), "fail");
  });

  it("un proceso colgado se marca como timeout y no bloquea", async () => {
    const startedAt = Date.now();
    const result = await runArgvWithTimeout(
      ["node", "-e", "setTimeout(() => {}, 120000)"],
      { timeoutMs: 500 }
    );
    assert.equal(result.timedOut, true);
    assert.equal(classifyRunResult(result), "timeout");
    assert.ok(Date.now() - startedAt < 20000, "el runner no debe esperar al proceso colgado");
  });

  it("al expirar termina también a los nietos (árbol de procesos)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "glowbook-lib-process-"));
    const pidFile = join(dir, "grandchild.pid");
    try {
      // El padre lanza un nieto que duerme y escribe su pid; después se queda colgado.
      const script = [
        "const { spawn } = require('node:child_process');",
        "const fs = require('node:fs');",
        "const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { stdio: 'inherit' });",
        "fs.writeFileSync(process.env.PID_FILE, String(child.pid));",
        "setTimeout(() => {}, 120000);",
      ].join("\n");
      const result = await runArgvWithTimeout(["node", "-e", script], {
        timeoutMs: 3000,
        env: { ...process.env, PID_FILE: pidFile },
      });
      assert.equal(result.timedOut, true);
      assert.ok(existsSync(pidFile), "el nieto debió arrancar antes del timeout");
      const grandchildPid = Number(readFileSync(pidFile, "utf8"));
      assert.equal(await waitUntilGone(grandchildPid), true, "el nieto debe morir con el árbol");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
