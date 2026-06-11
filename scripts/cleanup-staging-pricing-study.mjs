import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFileIfPresent() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=");
  }
}

function fail(message) {
  console.error(`[cleanup-pricing-study] ${message}`);
  process.exit(1);
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, "").toLowerCase();
}

function assertSafeBatchId(batchId) {
  if (!/^pricing-[a-zA-Z0-9-]+$/.test(batchId)) {
    fail("PRICING_STUDY_BATCH_ID must start with 'pricing-' and contain only letters, numbers and hyphens.");
  }
}

loadEnvFileIfPresent();

const appEnv = (
  process.env.GLOWBOOK_ENV ??
  process.env.APP_ENV ??
  process.env.VERCEL_ENV ??
  ""
).toLowerCase();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const confirm = process.env.PRICING_STUDY_CLEANUP_CONFIRM;
const batchId = process.env.PRICING_STUDY_BATCH_ID;

if (!batchId) fail("Set PRICING_STUDY_BATCH_ID to the pricing seed batch to delete.");
assertSafeBatchId(batchId);

if (appEnv !== "staging" && process.env.PRICING_STUDY_ALLOW_LOCAL !== "true") {
  fail("Set GLOWBOOK_ENV=staging, or PRICING_STUDY_ALLOW_LOCAL=true for local-only experiments.");
}
if (appEnv === "production") fail("Refusing to clean a production environment.");
if (!supabaseUrl || !serviceRoleKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
if (productionSupabaseUrl && normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)) {
  fail("Refusing to clean PRODUCTION_SUPABASE_URL.");
}
if (confirm !== `delete-${batchId}`) {
  fail(`Set PRICING_STUDY_CLEANUP_CONFIRM=delete-${batchId} to delete this staging batch.`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: salons, error: salonsError } = await admin
  .from("salons")
  .select("id, name, email")
  .like("email", `glowbook.${batchId}.owner.%@example.com`);
if (salonsError) throw salonsError;

console.log(`[cleanup-pricing-study] Deleting ${salons.length} salons for ${batchId}.`);

for (const salon of salons) {
  const { error } = await admin.rpc("delete_salon_completely", { p_salon_id: salon.id });
  if (error) throw new Error(`${salon.name}: ${error.message}`);
}

const { data: authUsers, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (authError) throw authError;

const usersToDelete = authUsers.users.filter((user) =>
  user.email?.startsWith(`glowbook.${batchId}.`)
);

for (const user of usersToDelete) {
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`${user.email}: ${error.message}`);
}

console.log(
  JSON.stringify(
    {
      batchId,
      deletedSalons: salons.length,
      deletedAuthUsers: usersToDelete.length,
    },
    null,
    2
  )
);
