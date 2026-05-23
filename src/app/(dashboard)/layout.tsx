import { redirect } from "next/navigation";
import { getProfile, isPlatformAdmin } from "@/lib/auth/session";
import { getPermissions } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  // Platform admins have no salon profile — send them to the platform area
  // instead of looping through /login.
  if (!profile) {
    if (await isPlatformAdmin()) redirect("/admin");
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("name, is_active")
    .eq("id", profile.salon_id)
    .single();

  if (!salon) redirect("/login");

  const permissions = getPermissions(profile);

  if (!salon.is_active) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Salón suspendido</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Este salón ha sido suspendido. Contacta a la plataforma para reactivarlo.
          </p>
          <form action="/api/auth/signout" method="post" className="mt-6">
            <button className="text-sm text-rose-600 hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar
        salonName={salon.name}
        userPermissions={permissions}
        isOwner={profile.is_owner}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
