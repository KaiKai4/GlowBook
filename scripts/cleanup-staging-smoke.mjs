import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL_PREFIX = "glowbook";

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

function normalizeUrl(value) {
  return value.replace(/\/+$/, "").toLowerCase();
}

function fail(message) {
  console.error(`[cleanup-staging-smoke] ${message}`);
  process.exit(1);
}

function assertSafeBatchId(batchId) {
  if (!/^smoke-[a-zA-Z0-9-]+$/.test(batchId)) {
    fail("SMOKE_SEED_BATCH_ID must start with 'smoke-' and contain only letters, numbers and hyphens.");
  }
}

async function deleteAuthUsersByEmailPrefix(admin, batchId) {
  const prefix = `${OWNER_EMAIL_PREFIX}.${batchId}.`;
  let page = 1;
  let deleted = 0;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const users = data.users ?? [];
    for (const user of users) {
      if (!user.email?.startsWith(prefix)) continue;
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError && deleteError.status !== 404) throw deleteError;
      deleted += 1;
    }

    if (users.length < 1000) break;
    page += 1;
  }

  return deleted;
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
const confirm = process.env.SMOKE_CLEANUP_CONFIRM;
const batchId = process.env.SMOKE_SEED_BATCH_ID;

if (appEnv !== "staging" && process.env.SMOKE_SEED_ALLOW_LOCAL !== "true") {
  fail("Set GLOWBOOK_ENV=staging, or SMOKE_SEED_ALLOW_LOCAL=true for local-only experiments.");
}

if (appEnv === "production") {
  fail("Refusing to cleanup a production environment.");
}

if (!supabaseUrl || !serviceRoleKey) {
  fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

if (
  productionSupabaseUrl &&
  normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)
) {
  fail("Refusing to cleanup PRODUCTION_SUPABASE_URL.");
}

if (!batchId) {
  fail("Set SMOKE_SEED_BATCH_ID to the batch you want to cleanup.");
}

assertSafeBatchId(batchId);

if (confirm !== "cleanup-5-salons") {
  fail("Set SMOKE_CLEANUP_CONFIRM=cleanup-5-salons to acknowledge persistent staging data deletion.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`[cleanup-staging-smoke] Cleaning batch ${batchId}`);

const emailPattern = `${OWNER_EMAIL_PREFIX}.${batchId}.owner.%@example.com`;
const { data: salons, error: salonError } = await admin
  .from("salons")
  .select("id, name, email")
  .like("email", emailPattern);

if (salonError) throw salonError;

let deletedSalons = 0;
let rpcAuthUsers = 0;

for (const salon of salons ?? []) {
  const { data: deletedUsers, error } = await admin.rpc("delete_salon_completely", {
    p_salon_id: salon.id,
  });
  if (error) throw error;

  for (const profile of deletedUsers ?? []) {
    if (!profile.user_id) continue;
    const { error: deleteError } = await admin.auth.admin.deleteUser(profile.user_id);
    if (deleteError && deleteError.status !== 404) throw deleteError;
    rpcAuthUsers += 1;
  }

  deletedSalons += 1;
  console.log(`[cleanup-staging-smoke] Deleted Salon ${salon.id} (${salon.name})`);
}

const extraAuthUsers = await deleteAuthUsersByEmailPrefix(admin, batchId);

console.log("[cleanup-staging-smoke] Done");
console.table({
  batchId,
  deletedSalons,
  authUsersFromSalonProfiles: rpcAuthUsers,
  extraAuthUsers,
});
