import Link from "next/link";
import { Building2, MailOpen, Users } from "lucide-react";
import { getPlatformAdminHome } from "@/features/platform/use-cases/get-platform-admin-home";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyInviteLink } from "./copy-invite-link";
import { inviteSalonAction } from "./actions";

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();

  const view = await getPlatformAdminHome();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Panel de Plataforma</h1>
        <p className="text-sm text-neutral-500 mt-1">Vista global del SaaS GlowBook</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Total salones</p>
                <p className="mt-1 text-3xl font-bold text-neutral-900">{view.metrics.totalSalons}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Salones activos</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{view.metrics.activeSalons}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Invitaciones pendientes</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">{view.metrics.pendingInvitations}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <MailOpen className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invitar nuevo salón</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={inviteSalonAction} className="flex gap-2">
              <input
                type="email"
                name="email"
                placeholder="email@salon.com"
                required
                className="h-9 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <Button type="submit" variant="primary">
                Invitar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            {view.pendingInvitations.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay invitaciones pendientes.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {view.pendingInvitations.slice(0, 5).map((invitation) => (
                  <li key={invitation.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-neutral-700 truncate">{invitation.email}</span>
                    <div className="flex items-center gap-2 shrink-0">
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Salones registrados</CardTitle>
            <Link href="/admin/salons">
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-neutral-100">
            {view.salons.slice(0, 10).map((salon) => (
              <div key={salon.id} className="py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{salon.name}</p>
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
    </div>
  );
}
