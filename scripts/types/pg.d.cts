// Declaración mínima del módulo "pg" (el paquete no incluye tipos ni hay @types/pg).
// Solo cubre la superficie que usan los scripts de medición de Supabase/Postgres.
declare module "pg" {
  export interface QueryResult<R> {
    rows: R[];
  }

  export interface ClientConfig {
    connectionString?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
  }

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }
}
