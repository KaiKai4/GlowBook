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
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-fg">
            <MailOpen className="h-6 w-6 text-accent" />
            Invitaciones
          </h1>
          <p className="mt-0.5 text-sm text-fg-subtle">
            Invita salones con su plan ya definido: al aceptar, el salon nace con los modulos y límites correctos.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-fg-muted">
          <Clock className="h-4 w-4 text-warning-fg" />
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
            <p className="rounded-xl border border-dashed border-warning-border bg-warning-subtle/50 px-4 py-6 text-center text-sm text-warning-strong">
              No hay planes activos. Crea y activa un plan en Planes antes de invitar:
              toda invitacion lleva el plan que tendra el salon al aceptar.
            </p>
          ) : (
            <InviteSalonForm plans={view.assignablePlans} />
          )}
        </CardContent>
      </Card>

      {view.pendingInvitations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <p className="text-sm text-fg-subtle">No hay invitaciones pendientes.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="hidden grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-border-subtle bg-surface-muted px-4 py-3 text-xs font-semibold uppercase text-fg-subtle md:grid">
            <span>Email</span>
            <span>Plan</span>
            <span>Creada</span>
            <span>Expira</span>
            <span>Accion</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {view.pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.7fr]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{invitation.email}</p>
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
                <p className="text-xs font-medium text-fg-secondary md:text-sm">
                  {invitation.planName ?? <span className="text-fg-subtle">Sin plan</span>}
                </p>
                <p className="text-xs text-fg-subtle md:text-sm">{invitation.createdAtLabel}</p>
                <p className="text-xs text-fg-subtle md:text-sm">{invitation.expiresAtLabel}</p>
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
            <CheckCircle2 className="h-4 w-4 text-success-fg" />
            Aceptadas recientemente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {view.acceptedInvitations.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-subtle">
              Cuando alguien acepte una invitacion aparecera aqui con su salon y plan.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {view.acceptedInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="grid gap-2 py-3 text-sm md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr]"
                >
                  <p className="truncate font-semibold text-fg">{invitation.email}</p>
                  <p className="truncate text-fg-secondary">{invitation.salonName}</p>
                  <p className="text-fg-secondary">
                    {invitation.planName ?? <span className="text-fg-subtle">Sin plan</span>}
                  </p>
                  <p className="text-xs text-fg-subtle md:text-sm">{invitation.acceptedAtLabel}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
