import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const TABLES = [
  "salons",
  "profiles",
  "customers",
  "employees",
  "service_categories",
  "services",
  "appointments",
  "appointment_items",
  "inventory_products",
  "inventory_stock_locations",
  "inventory_movements",
  "inventory_purchases",
  "inventory_purchase_items",
  "retail_sales",
  "retail_sale_items",
  "expenses",
];

function loadEnvFileIfPresent() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=").replace(/^"|"$/g, "");
  }
}

function fail(message) {
  console.error(`[measure-staging-db-size] ${message}`);
  process.exit(1);
}

function requirePg() {
  try {
    return createRequire(import.meta.url)("pg");
  } catch {
    const fallbackRequire = createRequire("C:/tmp/glowbook-pg-measure/package.json");
    return fallbackRequire("pg");
  }
}

loadEnvFileIfPresent();

const connectionString = process.env.STAGING_DATABASE_URL;
if (!connectionString) fail("STAGING_DATABASE_URL is not set.");

const appEnv = (process.env.GLOWBOOK_ENV ?? "").toLowerCase();
if (appEnv !== "staging") fail("Refusing to measure a non-staging environment.");

const { Client } = requirePg();
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const database = await client.query(`
    select
      current_database() as db,
      pg_database_size(current_database())::bigint as bytes,
      pg_size_pretty(pg_database_size(current_database())) as pretty
  `);

  const tables = await client.query(
    `
      select
        relname as table,
        pg_total_relation_size((quote_ident(schemaname) || '.' || quote_ident(relname))::regclass)::bigint as bytes,
        pg_size_pretty(pg_total_relation_size((quote_ident(schemaname) || '.' || quote_ident(relname))::regclass)) as pretty
      from pg_stat_user_tables
      where schemaname = $1
        and relname = any($2::text[])
      order by bytes desc
    `,
    ["public", TABLES]
  );

  const rows = await client.query(
    `
      select
        relname as table,
        n_live_tup::bigint as estimated_rows
      from pg_stat_user_tables
      where schemaname = $1
        and relname = any($2::text[])
      order by relname
    `,
    ["public", TABLES]
  );

  console.log(
    JSON.stringify(
      {
        database: database.rows[0],
        tables: tables.rows,
        estimatedRows: rows.rows,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        error: error.message,
        code: error.code ?? null,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
