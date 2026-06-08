import Link from "next/link";
import {
  ArrowRight,
  Building2,
  MailOpen,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformAdminHome } from "@/features/platform/use-cases/get-platform-admin-home";
import { requirePlatformAdmin } from "@/lib/auth/session";

import { inviteSalonAction } from "./actions";
import { CopyInviteLink } from "./copy-invite-link";

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();

  const view = await getPlatformAdminHome();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administracion global
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-950">
            Panel de Plataforma
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Vista operativa del SaaS GlowBook para salones, invitaciones, reportes y roles.
          </p>
        </div>
        <Link
          href="/admin/roles"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
        >
          Roles de plataforma
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <HomeMetric
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          label="Total salones"
          value={view.metrics.totalSalons}
        />
        <HomeMetric
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          label="Salones activos"
          value={view.metrics.activeSalons}
          valueClassName="text-emerald-600"
        />
        <HomeMetric
          icon={<MailOpen className="h-5 w-5 text-amber-600" />}
          label="Invitaciones pendientes"
          value={view.metrics.pendingInvitations}
          valueClassName="text-amber-600"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Invitar nuevo salon</CardTitle>
              <Send className="h-4 w-4 text-brand-600" />
            </div>
          </CardHeader>
          <CardContent>
            <form action={inviteSalonAction} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                name="email"
                placeholder="owner@salon.com"
                required
                className="h-11 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" variant="primary" className="h-11">
                Invitar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Invitaciones pendientes</CardTitle>
              <Link href="/admin/invitations" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Ver todas
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {view.pendingInvitations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
                <p className="text-sm text-neutral-400">No hay invitaciones pendientes.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {view.pendingInvitations.slice(0, 5).map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 truncate text-sm font-medium text-neutral-800">
                      {invitation.email}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <CopyInviteLink token={invitation.token} />
                      <Badge variant="warning">Pendiente</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Salones registrados</CardTitle>
              <Link href="/admin/salons" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-neutral-100">
              {view.salons.slice(0, 10).map((salon) => (
                <div key={salon.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-950">{salon.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {salon.contact_email || "Sin correo registrado"}
                    </p>
                  </div>
                  <Badge variant={salon.is_active ? "success" : "danger"}>
                    {salon.is_active ? "Activo" : "Suspendido"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <CardTitle>Accesos administrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AdminShortcut
              href="/admin/roles"
              icon={<ShieldCheck className="h-4 w-4 text-brand-600" />}
              title="Roles"
              detail="Permisos de plataforma"
            />
            <AdminShortcut
              href="/admin/audit"
              icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
              title="Auditoria"
              detail="Eventos cross-tenant"
            />
            <AdminShortcut
              href="/admin/reports"
              icon={<MailOpen className="h-4 w-4 text-amber-600" />}
              title="Reportes"
              detail="Fallas y sugerencias"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HomeMetric({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold text-neutral-950 ${valueClassName ?? ""}`}>
              {value}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminShortcut({
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
      className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 transition-colors hover:border-brand-200 hover:bg-white"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl bg-white p-2 shadow-sm">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950">{title}</p>
          <p className="truncate text-xs text-neutral-500">{detail}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </Link>
  );
}
