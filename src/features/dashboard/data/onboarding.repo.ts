import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";

export interface OnboardingCounts {
  services: number;
  employees: number;
  customers: number;
  appointments: number;
}

// Conteos head-only sobre indices por salon_id: baratos y con RLS del usuario.
export async function findOnboardingCounts(salonId: string): Promise<OnboardingCounts> {
  const supabase = await createSupabaseServerClient();

  const [services, employees, customers, appointments] = await Promise.all([
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId),
  ]);

  const failed = [services, employees, customers, appointments].find((response) => response.error);
  if (failed?.error) throw failed.error;

  return {
    services: services.count ?? 0,
    employees: employees.count ?? 0,
    customers: customers.count ?? 0,
    appointments: appointments.count ?? 0,
  };
}
