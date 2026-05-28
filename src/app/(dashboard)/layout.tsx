import { redirect } from "next/navigation";
import { getProfile, isPlatformAdmin } from "@/lib/auth/session";
import { getPermissions } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { FeedbackBubble } from "@/components/layout/feedback-bubble";
import { UnsavedChangesProvider } from "@/components/layout/unsaved-changes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogOut, Sparkles } from "lucide-react";

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

  if (!profile.is_active) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("name, is_active, theme, bg_style")
    .eq("id", profile.salon_id)
    .single();

  if (!salon) redirect("/login");

  const permissions = getPermissions(profile);
  const visibleNav = getVisibleNavItems(permissions, profile.is_owner);
  const theme = salon.theme || "violet";
  const bgStyle = salon.bg_style || "neutral";

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

  // Single-module collaborators (e.g. view-only stylists) don't need a sidebar —
  // show a slim top bar with branding + logout and let the content fill the screen.
  const minimalChrome = !profile.is_owner && visibleNav.length <= 1;

  if (minimalChrome) {
    return (
      <div data-theme={theme} className="flex h-screen flex-col overflow-hidden bg-neutral-50">
        <header className="flex items-center justify-between border-b border-brand-100 bg-white px-6 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900 truncate">{salon.name}</p>
              <p className="text-xs text-brand-400 font-medium">GlowBook</p>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
            >
              <LogOut className="h-4 w-4 text-stone-400" />
              Cerrar sesión
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
        </main>
        <FeedbackBubble />
      </div>
    );
  }

  return (
    <UnsavedChangesProvider>
      <div data-theme={theme} data-bg={bgStyle} className="flex h-screen overflow-hidden bg-neutral-50">
        <Sidebar
          salonName={salon.name}
          userPermissions={permissions}
          isOwner={profile.is_owner}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-6 py-8">{children}</div>
        </main>
        <FeedbackBubble />
      </div>
    </UnsavedChangesProvider>
  );
}
