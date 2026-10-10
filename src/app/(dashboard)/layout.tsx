import { redirect } from "next/navigation";
import { getProfile, isPlatformAdmin } from "@/app/_composition/request-context";
import { getCachedDashboardShell } from "@/app/_composition/salon-readers";
import { Sidebar } from "@/components/layout/sidebar";
import { getVisibleNavGroups } from "@/components/layout/nav-items";
import { FeedbackBubble } from "@/components/layout/feedback-bubble";
import { UnsavedChangesProvider } from "@/components/layout/unsaved-changes";
import { ToastProvider } from "@/components/ui/toast";
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

  const shell = await getCachedDashboardShell(profile);
  if (!shell) redirect("/login");

  const permissions = shell.permissions;
  const disabledFeatures = shell.disabledFeatures;
  // Los módulos visibles se calculan aquí (servidor); el sidebar solo los pinta.
  const navGroups = getVisibleNavGroups({ permissions, isOwner: profile.is_owner, disabledFeatures });
  const visibleNavCount = navGroups.reduce((total, group) => total + group.items.length, 0);
  const theme = shell.theme;
  const bgStyle = shell.bgStyle;

  if (!shell.isActive) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden bg-surface-muted px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-fg">Salón suspendido</h1>
          <p className="mt-2 text-sm text-fg-subtle">
            Este salón ha sido suspendido. Contacta a la plataforma para reactivarlo.
          </p>
          <form action="/api/auth/signout" method="post" className="mt-6">
            <button className="text-sm text-accent hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </div>
    );
  }

  // Suspension automatica por impago: vencido el periodo pagado (o el trial)
  // y agotada la ventana de gracia, el salón queda bloqueado hasta registrar
  // el pago. Se evalua al acceder; no requiere ningun job programado.
  if (shell.paymentStanding.state === "suspended") {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden bg-surface-muted px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-fg">Salón suspendido por falta de pago</h1>
          <p className="mt-2 text-sm text-fg-subtle">
            El plan venció el {shell.paymentStanding.overdueSince} y pasó el período de gracia.
            Contacta a GlowBook para registrar tu pago y reactivar el salón.
          </p>
          <form action="/api/auth/signout" method="post" className="mt-6">
            <button className="text-sm text-accent hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </div>
    );
  }

  // Single-module collaborators (e.g. view-only stylists) don't need a sidebar —
  // show a slim top bar with branding + logout and let the content fill the screen.
  const minimalChrome = !profile.is_owner && visibleNavCount <= 1;

  if (minimalChrome) {
    return (
      <ToastProvider>
      <div data-theme={theme} className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-surface-muted">
        <header className="flex items-center justify-between gap-4 border-b border-brand-100 bg-surface px-6 py-3 shadow-topbar">
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <GlowBookBrand markSize="sm" align="center" />
            <div className="min-w-0 max-w-full">
              <p className="text-sm font-semibold leading-tight text-fg break-words">{shell.salonName}</p>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-fg-subtle hover:bg-surface-muted hover:text-fg-secondary transition-colors"
            >
              <LogOut className="h-4 w-4 text-fg-subtle" />
              Cerrar sesión
            </button>
          </form>
        </header>
        <main tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
        </main>
        <FeedbackBubble submitFeedbackAction={submitFeedbackAction} />
      </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <UnsavedChangesProvider>
      <div
        data-theme={theme}
        data-bg={bgStyle}
        className="flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-surface-muted"
      >
        <Sidebar salonName={shell.salonName} groups={navGroups} />
        <main tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="w-full px-6 py-8">{children}</div>
        </main>
        <FeedbackBubble submitFeedbackAction={submitFeedbackAction} />
      </div>
    </UnsavedChangesProvider>
    </ToastProvider>
  );
}
