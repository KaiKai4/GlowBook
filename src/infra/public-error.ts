// Error con mensaje apto para el usuario. Vive en un modulo puro (sin Next, React
// ni Supabase) para que el dominio pueda lanzarlo: los use-cases lo convierten con
// toPublicErrorMessage (src/infra/errors.ts) y su mensaje sale tal cual.
export class PublicError extends Error {
  readonly code: string | undefined;

  constructor(message: string, options: { code?: string } = {}) {
    super(message);
    this.name = "PublicError";
    this.code = options.code;
  }
}
