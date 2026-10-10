import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Cookie } from "@playwright/test";

// Caché de sesiones E2E: un inicio de sesión real por usuario y ejecución.
// Vive en test-results/ (ignorado por git) y global-setup.ts la vacía al empezar,
// porque la BD local se reinicia entre ejecuciones del verificador.
const AUTH_CACHE_DIR = resolve(process.cwd(), "test-results", ".auth");

const LOCK_WAIT_MS = 60_000;
const LOCK_POLL_MS = 200;

interface CachedSession {
  cookies: Cookie[];
}

/** Nombre seguro del archivo de caché para un correo (solo letras, cifras y guiones). */
export function sessionCacheFile(email: string): string {
  const safe = email.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return join(AUTH_CACHE_DIR, `${safe}.json`);
}

export async function clearSessionCache(): Promise<void> {
  await rm(AUTH_CACHE_DIR, { recursive: true, force: true });
  await mkdir(AUTH_CACHE_DIR, { recursive: true });
}

export async function readCachedSession(file: string): Promise<CachedSession | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (typeof parsed !== "object" || parsed === null || !("cookies" in parsed)) return null;
    const cookies = (parsed as { cookies: unknown }).cookies;
    return Array.isArray(cookies) && cookies.length > 0 ? { cookies: cookies as Cookie[] } : null;
  } catch {
    return null;
  }
}

/** Escribe a un temporal y renombra: otro worker nunca lee un archivo a medio escribir. */
export async function writeCachedSession(file: string, cookies: Cookie[]): Promise<void> {
  await mkdir(AUTH_CACHE_DIR, { recursive: true });
  const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temp, JSON.stringify({ cookies }), "utf8");
  await rename(temp, file);
}

export async function removeCachedSession(file: string): Promise<void> {
  await rm(file, { force: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Reserva el inicio de sesión de un usuario entre workers con un archivo de bloqueo
 * creado en exclusiva. Devuelve true si este worker debe iniciar sesión; false si otro
 * ya dejó la caché escrita mientras esperábamos.
 */
export async function claimLoginSlot(file: string): Promise<boolean> {
  const lock = `${file}.lock`;
  await mkdir(AUTH_CACHE_DIR, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      await writeFile(lock, String(process.pid), { flag: "wx" });
      return true;
    } catch {
      if (await readCachedSession(file)) return false;
      await sleep(LOCK_POLL_MS);
    }
  }
  // Bloqueo huérfano (un worker murió a medias): se toma por la fuerza.
  await rm(lock, { force: true });
  return true;
}

export async function releaseLoginSlot(file: string): Promise<void> {
  await rm(`${file}.lock`, { force: true });
}
