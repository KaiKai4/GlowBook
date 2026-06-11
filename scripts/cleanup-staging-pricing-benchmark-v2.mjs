import { createClient } from "@supabase/supabase-js";
import {
  assertBenchmarkBatchId,
  assertStagingEnvironment,
  fail,
} from "./pricing-benchmark-shared.mjs";

const SCOPE = "cleanup-pricing-benchmark-v2";

assertStagingEnvironment(SCOPE);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) fail(SCOPE, "Set SUPABASE_SERVICE_ROLE_KEY.");

const batchId = process.env.PRICING_BENCHMARK_BATCH_ID;
if (!batchId) fail(SCOPE, "Set PRICING_BENCHMARK_BATCH_ID.");
assertBenchmarkBatchId(SCOPE, batchId);

const confirm = process.env.PRICING_BENCHMARK_CLEANUP_CONFIRM;
if (confirm !== `delete-${batchId}`) {
  fail(SCOPE, `Set PRICING_BENCHMARK_CLEANUP_CONFIRM=delete-${batchId} to delete this staging benchmark batch.`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: salons, error: salonsError } = await admin
  .from("salons")
  .select("id, name, email")
  .like("email", `glowbook.${batchId}.%.owner.%@example.com`);
if (salonsError) throw salonsError;

console.log(`[${SCOPE}] Deleting ${salons.length} benchmark salons for ${batchId}.`);

for (const salon of salons) {
  const { error } = await admin.rpc("delete_salon_completely", { p_salon_id: salon.id });
  if (error) throw new Error(`${salon.name}: ${error.message}`);
}

let page = 1;
let deletedAuthUsers = 0;
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  const users = data.users.filter((user) => user.email?.startsWith(`glowbook.${batchId}.`));
  for (const user of users) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`${user.email}: ${deleteError.message}`);
    deletedAuthUsers += 1;
  }
  if (data.users.length < 1000) break;
  page += 1;
}

console.log(JSON.stringify({ batchId, deletedSalons: salons.length, deletedAuthUsers }, null, 2));
