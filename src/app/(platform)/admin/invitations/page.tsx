import { Clock, MailOpen, Plus, TimerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getPlatformInvitations } from "@/features/platform/use-cases/get-platform-invitations";
import { inviteSalonAction } from "../actions";
import { CopyInviteLink } from "../copy-invite-link";

export default async function PlatformInvitationsPage() {
  await requirePlatformAdmin();
  const view = await getPlatformInvitations();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900">
            <MailOpen className="h-6 w-6 text-rose-500" />
            Invitaciones
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Invitaciones pendientes para crear nuevos salones en GlowBook.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <Clock className="h-4 w-4 text-amber-600" />
          {view.pendingCount} pendiente{view.pendingCount === 1 ? "" : "s"}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Invitar Salon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteSalonAction} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              name="email"
              placeholder="owner@salon.com"
              required
              className="h-9 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <Button type="submit" variant="primary">
              Invitar
            </Button>
          </form>
        </CardContent>
      </Card>

      {view.pendingInvitations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
          <p className="text-sm text-neutral-400">No hay invitaciones pendientes.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-400 md:grid">
            <span>Email</span>
            <span>Creada</span>
            <span>Expira</span>
            <span>Accion</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {view.pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">{invitation.email}</p>
                  <div className="mt-1">
                    {invitation.expired ? (
                      <Badge variant="danger">
                        <TimerOff className="mr-1 h-3 w-3" />
                        Expirada
                      </Badge>
                    ) : (
                      <Badge variant="warning">Pendiente</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-neutral-500 md:text-sm">{invitation.createdAtLabel}</p>
                <p className="text-xs text-neutral-500 md:text-sm">{invitation.expiresAtLabel}</p>
                <div>
                  <CopyInviteLink token={invitation.token} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
