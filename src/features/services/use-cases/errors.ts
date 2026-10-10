function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function isUniqueConstraintError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = errorMessage(error).toLowerCase();
  return code === "23505" || message.includes("unique") || message.includes("duplicate");
}
