"use client";

import {
  BarChart3,
  Bell,
  CalendarDays,
  LayoutDashboard,
  MessageSquareText,
  Package,
  ReceiptText,
  Scissors,
  Settings,
  Shield,
  ShoppingBag,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, MouseEvent } from "react";

import { cn } from "@/components/ui/cn";

import type { NavGroup, NavIconName } from "./nav-items";
import {
  GROUP_LABEL,
  GROUP_SEPARATOR,
  GROUP_STACK,
  ITEM_LAYOUT,
  LABEL_FADE,
  NAV_PADDING,
  NO_MODULES_HINT,
} from "./sidebar-layout";
import type { SidebarPreference } from "./sidebar-store";

const NAV_ICONS: Record<NavIconName, ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  bell: Bell,
  users: Users,
  "user-cog": UserCog,
  scissors: Scissors,
  "shopping-bag": ShoppingBag,
  package: Package,
  "bar-chart": BarChart3,
  receipt: ReceiptText,
  shield: Shield,
  message: MessageSquareText,
  settings: Settings,
};

interface SidebarNavProps {
  groups: NavGroup[];
  pathname: string;
  preference: SidebarPreference;
  isCollapsed: boolean;
  onNavigate: (event: MouseEvent, href: string) => void;
}

/** "Inicio" no exige permisos: el aviso se basa en los módulos reales, no en los grupos. */
function hasAnyModule(groups: NavGroup[]): boolean {
  return groups.some((group) => group.items.some((item) => item.href !== "/"));
}

function isItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarNav({
  groups,
  pathname,
  preference,
  isCollapsed,
  onNavigate,
}: SidebarNavProps) {
  return (
    <nav
      className={cn(
        "flex-1 overflow-y-auto pb-4 pt-3 transition-[padding] duration-200 motion-reduce:transition-none",
        NAV_PADDING[preference],
      )}
    >
      {!hasAnyModule(groups) ? (
        <p
          className={cn(
            "px-3 py-4 text-xs leading-relaxed text-fg-subtle",
            NO_MODULES_HINT[preference],
          )}
        >
          No tienes módulos asignados. Pide al administrador que configure tu
          rol.
        </p>
      ) : null}
      <div className={cn(GROUP_STACK[preference])}>
        {groups.map((group, groupIndex) => (
          <div
            key={group.label ?? `group-${groupIndex}`}
            className={cn(groupIndex > 0 && GROUP_SEPARATOR[preference])}
          >
            {group.label && preference !== "collapsed" ? (
              <p
                className={cn(
                  "mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle",
                  GROUP_LABEL[preference],
                )}
              >
                {group.label}
              </p>
            ) : null}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isItemActive(item.href, pathname);
                const Icon = NAV_ICONS[item.icon];

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={(event) => onNavigate(event, item.href)}
                      title={isCollapsed ? item.label : undefined}
                      aria-label={isCollapsed ? item.label : undefined}
                      className={cn(
                        "grid min-h-10 items-center rounded-lg py-2.5 text-sm font-medium transition-[background-color,color,grid-template-columns,gap,padding] duration-200 motion-reduce:transition-none",
                        ITEM_LAYOUT[preference],
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-fg-subtle hover:bg-surface-muted hover:text-fg-secondary",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-brand-600" : "text-fg-subtle",
                        )}
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          "min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
                          LABEL_FADE[preference],
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
