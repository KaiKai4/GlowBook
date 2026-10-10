// Hash SHA-256 del contenido de un formulario. La serialización canónica la pone infra
// (toCanonicalPayload): dos envíos con el mismo contenido lógico, sea cual sea el orden
// de las claves, producen el mismo hash.

import { toCanonicalPayload } from "@/infra/idempotency/canonical-json";

export async function hashSubmissionData(data: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(toCanonicalPayload(data)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
