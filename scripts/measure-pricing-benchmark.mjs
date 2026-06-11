import { Client } from "pg";
import {
  TABLES_WITH_SALON_ID,
  assertBenchmarkBatchId,
  assertStagingEnvironment,
  fail,
  mb,
  round,
} from "./pricing-benchmark-shared.mjs";

const SCOPE = "measure-pricing-benchmark";
const SUPABASE_PRO_INCLUDED_DB_GB = 8;
const SUPABASE_EXTRA_DB_USD_PER_GB = 0.125;
const SUPABASE_INCLUDED_EGRESS_GB = 250;
const SUPABASE_EXTRA_EGRESS_USD_PER_GB = 0.09;

assertStagingEnvironment(SCOPE);

const connectionString = process.env.STAGING_DATABASE_URL;
if (!connectionString) fail(SCOPE, "Set STAGING_DATABASE_URL.");

const batchId = process.env.PRICING_BENCHMARK_BATCH_ID;
if (!batchId) fail(SCOPE, "Set PRICING_BENCHMARK_BATCH_ID.");
assertBenchmarkBatchId(SCOPE, batchId);

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

function extraDbCost(projectedMb) {
  const projectedGb = projectedMb / 1024;
  return round(Math.max(projectedGb - SUPABASE_PRO_INCLUDED_DB_GB, 0) * SUPABASE_EXTRA_DB_USD_PER_GB, 4);
}

function extraEgressCost(projectedGb) {
  return round(Math.max(projectedGb - SUPABASE_INCLUDED_EGRESS_GB, 0) * SUPABASE_EXTRA_EGRESS_USD_PER_GB, 4);
}

try {
  await client.connect();

  const database = await client.query(`
    select
      current_database() as db,
      pg_database_size(current_database())::bigint as bytes,
      pg_size_pretty(pg_database_size(current_database())) as pretty
  `);

  const tableSizes = await client.query(
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
    ["public", TABLES_WITH_SALON_ID]
  );

  const salons = await client.query(
    `
      select
        id,
        case
          when name like 'Benchmark A - %' then 'A'
          when name like 'Benchmark B - %' then 'B'
          when name like 'Benchmark C - %' then 'C'
          when name like 'Benchmark D - %' then 'D'
          when name like 'Benchmark E - %' then 'E'
          else 'unknown'
        end as cohort
      from public.salons
      where email like $1
    `,
    [`glowbook.${batchId}.%.owner.%@example.com`]
  );

  const salonIds = salons.rows.map((row) => row.id);
  if (salonIds.length === 0) fail(SCOPE, `No benchmark salons found for ${batchId}.`);

  const tableRows = [];
  for (const table of TABLES_WITH_SALON_ID) {
    const result = await client.query(
      `select salon_id::text as salon_id, count(*)::bigint as rows from public.${table} where salon_id = any($1::uuid[]) group by salon_id`,
      [salonIds]
    ).catch(async (error) => {
      if (table === "salons") {
        return client.query(
          "select id::text as salon_id, count(*)::bigint as rows from public.salons where id = any($1::uuid[]) group by id",
          [salonIds]
        );
      }
      throw error;
    });

    for (const row of result.rows) tableRows.push({ table, salon_id: row.salon_id, rows: Number(row.rows) });
  }

  const salonToCohort = new Map(salons.rows.map((row) => [row.id, row.cohort]));
  const sizeByTable = new Map(tableSizes.rows.map((row) => [row.table, Number(row.bytes)]));
  const rowsByTable = new Map();
  for (const row of tableRows) rowsByTable.set(row.table, (rowsByTable.get(row.table) ?? 0) + row.rows);

  const cohortSummaries = {};
  for (const salon of salons.rows) {
    cohortSummaries[salon.cohort] ??= { cohort: salon.cohort, salons: 0, estimatedBytes: 0, rows: {} };
    cohortSummaries[salon.cohort].salons += 1;
  }

  for (const row of tableRows) {
    const cohort = salonToCohort.get(row.salon_id) ?? "unknown";
    const tableTotalRows = rowsByTable.get(row.table) ?? 0;
    const tableBytes = sizeByTable.get(row.table) ?? 0;
    const estimatedBytes = tableTotalRows > 0 ? (tableBytes * row.rows) / tableTotalRows : 0;
    cohortSummaries[cohort] ??= { cohort, salons: 0, estimatedBytes: 0, rows: {} };
    cohortSummaries[cohort].estimatedBytes += estimatedBytes;
    cohortSummaries[cohort].rows[row.table] = (cohortSummaries[cohort].rows[row.table] ?? 0) + row.rows;
  }

  const cohorts = Object.values(cohortSummaries)
    .sort((a, b) => a.cohort.localeCompare(b.cohort))
    .map((cohort) => ({
      ...cohort,
      estimatedMB: mb(cohort.estimatedBytes),
      estimatedMBPerSalon: round(mb(cohort.estimatedBytes) / Math.max(cohort.salons, 1), 3),
    }));

  const functionalBytes = tableSizes.rows.reduce((total, row) => total + Number(row.bytes), 0);
  const functionalMB = mb(functionalBytes);
  const avgFunctionalMBPerSalon = round(functionalMB / salons.rows.length, 3);

  const projections = [10, 50, 100, 250, 500].map((salonCount) => {
    const projectedDbMb = avgFunctionalMBPerSalon * salonCount;
    return {
      salons: salonCount,
      projectedFunctionalDBMB: round(projectedDbMb, 3),
      projectedExtraSupabaseDBStorageUSD: extraDbCost(projectedDbMb),
      projectedEgressGB: null,
      projectedExtraSupabaseEgressUSD: extraEgressCost(0),
      note: "Egress requires pricing:measure-routes results; DB projection only uses table-size averages.",
    };
  });

  console.log(
    JSON.stringify(
      {
        batchId,
        database: { ...database.rows[0], mb: mb(database.rows[0].bytes) },
        functionalTables: tableSizes.rows.map((row) => ({ ...row, mb: mb(row.bytes) })),
        benchmarkSalons: salons.rows.length,
        functionalMB,
        avgFunctionalMBPerSalon,
        cohorts,
        projections,
        pricingInputs: {
          supabaseProIncludedDatabaseGB: SUPABASE_PRO_INCLUDED_DB_GB,
          supabaseExtraDatabaseUsdPerGB: SUPABASE_EXTRA_DB_USD_PER_GB,
          supabaseIncludedEgressGB: SUPABASE_INCLUDED_EGRESS_GB,
          supabaseExtraEgressUsdPerGB: SUPABASE_EXTRA_EGRESS_USD_PER_GB,
        },
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(JSON.stringify({ error: error.message, code: error.code ?? null }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
