"use client";

import {
  BadgeDollarSign,
  Building2,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  MailOpen,
  MessageSquareWarning,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { cn } from "@/lib/utils/cn";

const PLATFORM_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/salons", label: "Salones", icon: Building2 },
  { href: "/admin/plans", label: "Planes", icon: CreditCard },
  { href: "/admin/subscriptions", label: "Suscripciones", icon: BadgeDollarSign },
  { href: "/admin/invitations", label: "Invitaciones", icon: MailOpen },
  { href: "/admin/reports", label: "Reportes", icon: MessageSquareWarning },
  { href: "/admin/audit", label: "Auditoria", icon: History },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function PlatformAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand-100 bg-white shadow-[1px_0_8px_rgba(0,0,0,0.04)]">
      <div className="border-b border-brand-50 px-5 py-5">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <GlowBookBrand markSize="sm" align="center" />
          <p className="text-xs font-semibold leading-tight text-stone-900">Plataforma</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {PLATFORM_NAV_ITEMS.map((item) => {
            const isActive = isActiveRoute(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-stone-500 hover:bg-stone-50 hover:text-stone-900",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-brand-600" : "text-stone-400",
                    )}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-brand-50 p-3">
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-900"
          >
            <LogOut className="h-4 w-4 text-stone-400" aria-hidden="true" />
            Cerrar sesion
          </button>
        </form>
      </div>
    </aside>
  );
}
