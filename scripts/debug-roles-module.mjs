// Diagnostico puntual: por que el modulo Roles aparece en el nav pero la
// pagina lo niega. Compara la columna legacy salons.disabled_features contra
// los modulos del plan asignado y los overrides activos. Solo lectura.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envFile = process.argv[2] ?? "../.env.local";
const env = Object.fromEntries(
  readFileSync(new URL(envFile, import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: salons } = await admin.from("salons").select("id, name, disabled_features, is_active");

for (const salon of salons ?? []) {
  console.log(`\n=== Salon: ${salon.name} (${salon.id}) activo=${salon.is_active}`);
  console.log(`  legacy disabled_features: [${(salon.disabled_features ?? []).join(", ")}]`);

  const { data: assignment } = await admin
    .from("salon_plan_assignments")
    .select("plan_id, status")
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (!assignment) {
    console.log("  sin plan asignado");
    continue;
  }

  const { data: plan } = await admin
    .from("commercial_plans")
    .select("name, status")
    .eq("id", assignment.plan_id)
    .single();
  console.log(`  plan: ${plan?.name} (asignacion=${assignment.status}, plan_status=${plan?.status})`);

  const { data: modules } = await admin
    .from("commercial_plan_modules")
    .select("module_key, enabled")
    .eq("plan_id", assignment.plan_id)
    .order("module_key");
  console.log(`  modulos del plan: ${(modules ?? []).map((m) => `${m.module_key}=${m.enabled ? "ON" : "off"}`).join(", ") || "(sin filas)"}`);

  const { data: overrides } = await admin
    .from("salon_plan_overrides")
    .select("module_key, metric_key, module_enabled, status, starts_at, ends_at")
    .eq("salon_id", salon.id);
  console.log(`  overrides: ${(overrides ?? []).length === 0 ? "(ninguno)" : JSON.stringify(overrides)}`);

  const { data: profiles } = await admin
    .from("profiles")
    .select("full_name, is_owner, is_active, role:roles(name, role_permissions(permission:permissions(key)))")
    .eq("salon_id", salon.id);
  for (const p of profiles ?? []) {
    const perms = p.role?.role_permissions?.map((rp) => rp.permission?.key).filter(Boolean) ?? [];
    console.log(`  perfil: ${p.full_name} owner=${p.is_owner} activo=${p.is_active} rol=${p.role?.name ?? "-"} permisos=[${perms.join(", ")}]`);
  }
}
