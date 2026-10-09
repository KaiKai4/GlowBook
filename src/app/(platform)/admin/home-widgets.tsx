import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function HomeMetric({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-fg-subtle">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${highlight ? "text-warning-fg" : "text-fg-strong"}`}>
              {value}
            </p>
          </div>
          <div className="rounded-xl bg-surface-muted p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminShortcut({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted px-3 py-3 transition-colors hover:border-brand-200 hover:bg-surface"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl bg-surface p-2 shadow-sm">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg-strong">{title}</p>
          <p className="truncate text-xs text-fg-subtle">{detail}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" />
    </Link>
  );
}
