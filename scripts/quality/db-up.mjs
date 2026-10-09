// Arranca el stack de Supabase LOCAL (Docker). No toca staging ni producción.
import { ensureLocalSupabase } from "./supabase-env.mjs";

try {
  await ensureLocalSupabase();
  console.log("Supabase local activo. Usa \"npm run db:reset\" para aplicar migraciones desde cero.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
