import { requirePlatformAdmin } from "@/lib/auth/session";
import { Building2, MailOpen, LayoutDashboard, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Platform admin sidebar — distinct from tenant sidebar */}
      <aside className="flex h-full w-56 flex-col border-r border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-neutral-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">GlowBook</p>
            <p className="text-xs text-neutral-500">Plataforma</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-0.5">
            {[
              { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
              { href: "/admin/salons", label: "Salones", icon: Building2 },
              { href: "/admin/invitations", label: "Invitaciones", icon: MailOpen },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
