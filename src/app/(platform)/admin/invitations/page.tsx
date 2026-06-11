import { CheckCircle2, Clock, MailOpen, Plus, TimerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getPlatformInvitations } from "@/features/platform/use-cases/get-platform-invitations";
import { RegenerateInviteLink } from "../regenerate-invite-link";
import { InviteSalonForm } from "./invite-salon-form";

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
            Invita salones con su plan ya definido: al aceptar, el salon nace con los modulos y limites correctos.
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
          {view.assignablePlans.length === 0 ? (
            <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center text-sm text-amber-800">
              No hay planes activos. Crea y activa un plan en Planes antes de invitar:
              toda invitacion lleva el plan que tendra el salon al aceptar.
            </p>
          ) : (
            <InviteSalonForm plans={view.assignablePlans} />
          )}
        </CardContent>
      </Card>

      {view.pendingInvitations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
          <p className="text-sm text-neutral-400">No hay invitaciones pendientes.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-400 md:grid">
            <span>Email</span>
            <span>Plan</span>
            <span>Creada</span>
            <span>Expira</span>
            <span>Accion</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {view.pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.7fr]"
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
                <p className="text-xs font-medium text-neutral-700 md:text-sm">
                  {invitation.planName ?? <span className="text-neutral-400">Sin plan</span>}
                </p>
                <p className="text-xs text-neutral-500 md:text-sm">{invitation.createdAtLabel}</p>
                <p className="text-xs text-neutral-500 md:text-sm">{invitation.expiresAtLabel}</p>
                <div>
                  <RegenerateInviteLink invitationId={invitation.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Aceptadas recientemente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {view.acceptedInvitations.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              Cuando alguien acepte una invitacion aparecera aqui con su salon y plan.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {view.acceptedInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="grid gap-2 py-3 text-sm md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr]"
                >
                  <p className="truncate font-semibold text-neutral-900">{invitation.email}</p>
                  <p className="truncate text-neutral-700">{invitation.salonName}</p>
                  <p className="text-neutral-700">
                    {invitation.planName ?? <span className="text-neutral-400">Sin plan</span>}
                  </p>
                  <p className="text-xs text-neutral-500 md:text-sm">{invitation.acceptedAtLabel}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
