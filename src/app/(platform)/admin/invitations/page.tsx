import { CheckCircle2, Clock, MailOpen, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { getPlatformInvitations } from "@/features/platform/use-cases/get-platform-invitations";
import { InviteSalonForm } from "./invite-salon-form";
import { AcceptedInvitationsTable, PendingInvitationsTable } from "./invitations-tables";

export default async function PlatformInvitationsPage() {
  await requirePlatformAdmin();
  const view = await getPlatformInvitations();

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <MailOpen className="h-6 w-6 text-accent" aria-hidden="true" />
            Invitaciones
          </span>
        }
        description="Invita salones con su plan ya definido: al aceptar, el salon nace con los modulos y límites correctos."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-fg-muted">
            <Clock className="h-4 w-4 text-warning-fg" aria-hidden="true" />
            {view.pendingCount} pendiente{view.pendingCount === 1 ? "" : "s"}
          </div>
        }
      />

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
        <PendingInvitationsTable rows={view.pendingInvitations} />
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
            <AcceptedInvitationsTable rows={view.acceptedInvitations} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
