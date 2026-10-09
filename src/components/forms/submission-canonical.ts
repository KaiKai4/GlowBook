// Canonical serialization + SHA-256 of a form's data. Two submissions with the same
// logical content (regardless of key insertion order) must produce the same hash.

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeys(source[key])])
    );
  }
  return value;
}

function canonicalizeSubmissionData(data: unknown): string {
  return JSON.stringify(sortKeys(data));
}

export async function hashSubmissionData(data: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeSubmissionData(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
