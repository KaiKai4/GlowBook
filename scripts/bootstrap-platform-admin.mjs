// Bootstrap the first platform super-admin (the SaaS owner).
// This is the only account that must be created manually: it can invite salons,
// and salons can only be created via an invitation. Chicken-and-egg solved here.
//
// Usage (password never goes through git/chat):
//   node --env-file=.env.local scripts/bootstrap-platform-admin.mjs <email> <password>
//
// Re-runnable: if the user already exists, it just ensures the platform_admins row.

import { createClient } from "@supabase/supabase-js";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Uso: node --env-file=.env.local scripts/bootstrap-platform-admin.mjs <email> <password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

// 1. Create the auth user (email pre-confirmed so they can log in immediately).
let userId;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createErr) {
  // User may already exist — look them up instead.
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    console.error("No se pudo crear ni encontrar el usuario:", createErr.message);
    process.exit(1);
  }
  userId = existing.id;
  console.log("Usuario ya existía, reutilizando:", userId);
} else {
  userId = created.user.id;
  console.log("Usuario creado:", userId);
}

// 2. Add to platform_admins (idempotent).
const { error: padminErr } = await admin
  .from("platform_admins")
  .upsert({ user_id: userId }, { onConflict: "user_id" });

if (padminErr) {
  console.error("Error al insertar en platform_admins:", padminErr.message);
  process.exit(1);
}

console.log("✓ Listo. " + email + " es platform admin.");
console.log("  Inicia sesión en /login y entra a /admin para invitar salones.");
