import { CheckCircle2, Clock, MailOpen, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformAdmin } from "@/infra/auth/session";
import { getPlatformInvitations } from "@/features/platform/use-cases/get-platform-invitations";
import type { PlatformInvitationsViewModel } from "@/features/platform/use-cases/get-platform-invitations";
import { RegenerateInviteLink } from "../regenerate-invite-link";
import { InviteSalonForm } from "./invite-salon-form";

type PendingInvitation = PlatformInvitationsViewModel["pendingInvitations"][number];
type AcceptedInvitation = PlatformInvitationsViewModel["acceptedInvitations"][number];

const PENDING_COLUMNS: DataTableColumn<PendingInvitation>[] = [
  {
    id: "email",
    header: "Email",
    cell: (invitation) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-fg">{invitation.email}</p>
        <div className="mt-1">
          {invitation.expired ? (
            <StatusBadge variant="danger" label="Expirada" />
          ) : (
            <StatusBadge variant="warning" label="Pendiente" />
          )}
        </div>
      </div>
    ),
  },
  {
    id: "plan",
    header: "Plan",
    cell: (invitation) =>
      invitation.planName ?? <span className="text-fg-subtle">Sin plan</span>,
  },
  {
    id: "created",
    header: "Creada",
    secondary: true,
    cell: (invitation) => <span className="text-xs text-fg-subtle md:text-sm">{invitation.createdAtLabel}</span>,
  },
  {
    id: "expires",
    header: "Expira",
    secondary: true,
    cell: (invitation) => <span className="text-xs text-fg-subtle md:text-sm">{invitation.expiresAtLabel}</span>,
  },
  {
    id: "action",
    header: "Accion",
    cell: (invitation) => <RegenerateInviteLink invitationId={invitation.id} />,
  },
];

const ACCEPTED_COLUMNS: DataTableColumn<AcceptedInvitation>[] = [
  {
    id: "email",
    header: "Email",
    cell: (invitation) => <p className="truncate font-semibold text-fg">{invitation.email}</p>,
  },
  {
    id: "salon",
    header: "Salón",
    secondary: true,
    cell: (invitation) => <span className="truncate text-fg-secondary">{invitation.salonName}</span>,
  },
  {
    id: "plan",
    header: "Plan",
    cell: (invitation) =>
      invitation.planName ?? <span className="text-fg-subtle">Sin plan</span>,
  },
  {
    id: "accepted",
    header: "Aceptada",
    secondary: true,
    cell: (invitation) => <span className="text-xs text-fg-subtle md:text-sm">{invitation.acceptedAtLabel}</span>,
  },
];

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
        <DataTable
          label="Invitaciones pendientes"
          columns={PENDING_COLUMNS}
          rows={view.pendingInvitations}
          getRowId={(invitation) => invitation.id}
          emptyMessage="No hay invitaciones pendientes."
        />
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
            <DataTable
              label="Invitaciones aceptadas"
              columns={ACCEPTED_COLUMNS}
              rows={view.acceptedInvitations}
              getRowId={(invitation) => invitation.id}
              emptyMessage="Cuando alguien acepte una invitacion aparecera aqui con su salon y plan."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
