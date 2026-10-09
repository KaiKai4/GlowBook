// Salón y owner de prueba para las auditorías autenticadas de Lighthouse.
// Usa el service role del stack LOCAL (nunca staging ni producción) y limpia al terminar.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "GlowBookLighthouse123!";

/**
 * Crea un salón con un owner confirmado y horario de negocio.
 * @param {{ url: string, serviceRoleKey: string }} env
 * @returns {Promise<{ email: string, password: string, userId: string, salonId: string, cleanup: () => Promise<void> }>}
 */
export async function createLighthouseOwner({ url, serviceRoleKey }) {
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const email = `glowbook.lighthouse.${Date.now()}.${randomUUID()}@example.com`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("Auth user not created");
  const userId = authData.user.id;

  const { data: salon, error: salonError } = await admin
    .from("salons")
    .insert({
      name: `Lighthouse Salon ${Date.now()}`,
      email,
      phone: "60000000",
      timezone: "America/Panama",
      theme: "violet",
      bg_style: "neutral",
      disabled_features: [],
      min_booking_notice_minutes: 0,
    })
    .select("id")
    .single();
  if (salonError) {
    await admin.auth.admin.deleteUser(userId);
    throw salonError;
  }
  const salonId = salon.id;

  const cleanup = async () => {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("salons").delete().eq("id", salonId);
  };

  try {
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      salon_id: salonId,
      full_name: "Lighthouse Owner",
      is_owner: true,
      is_active: true,
    });
    if (profileError) throw profileError;

    const { error: hoursError } = await admin.from("salon_business_hours").insert(
      Array.from({ length: 7 }, (_, day) => ({
        salon_id: salonId,
        day_of_week: day,
        is_open: true,
        open_time: "09:00",
        close_time: "17:00",
      }))
    );
    if (hoursError) throw hoursError;
  } catch (error) {
    await cleanup();
    throw error;
  }

  return { email, password: PASSWORD, userId, salonId, cleanup };
}
