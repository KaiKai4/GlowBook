import { redirect } from "next/navigation";
import { getProfile, isPlatformAdmin } from "@/lib/auth/session";
import { getDashboardShell } from "@/features/salon/use-cases/get-dashboard-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { FeedbackBubble } from "@/components/layout/feedback-bubble";
import { UnsavedChangesProvider } from "@/components/layout/unsaved-changes";
import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { submitFeedbackAction } from "./feedback/actions";
import { LogOut } from "lucide-react";

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

  const shell = await getDashboardShell(profile);
  if (!shell) redirect("/login");

  const permissions = shell.permissions;
  const disabledFeatures = shell.disabledFeatures;
  const visibleNav = getVisibleNavItems(permissions, profile.is_owner, disabledFeatures);
  const theme = shell.theme;
  const bgStyle = shell.bgStyle;

  if (!shell.isActive) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden bg-neutral-50 px-4">
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
      <div data-theme={theme} className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-neutral-50">
        <header className="flex items-center justify-between gap-4 border-b border-brand-100 bg-white px-6 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <GlowBookBrand markSize="sm" align="center" />
            <div className="min-w-0 max-w-full">
              <p className="text-sm font-semibold leading-tight text-stone-900 break-words">{shell.salonName}</p>
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
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
        </main>
        <FeedbackBubble submitFeedbackAction={submitFeedbackAction} />
      </div>
    );
  }

  return (
    <UnsavedChangesProvider>
      <div
        data-theme={theme}
        data-bg={bgStyle}
        className="flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-neutral-50"
      >
        <Sidebar
          salonName={shell.salonName}
          userPermissions={permissions}
          isOwner={profile.is_owner}
          disabledFeatures={disabledFeatures}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="w-full px-6 py-8">{children}</div>
        </main>
        <FeedbackBubble submitFeedbackAction={submitFeedbackAction} />
      </div>
    </UnsavedChangesProvider>
  );
}
