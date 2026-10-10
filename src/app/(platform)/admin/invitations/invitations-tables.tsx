"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PlatformInvitationsViewModel } from "@/features/platform/use-cases/get-platform-invitations";
import { RegenerateInviteLink } from "../regenerate-invite-link";

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
    header: "Acción",
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

export function PendingInvitationsTable({ rows }: { rows: PendingInvitation[] }) {
  return (
    <DataTable
      label="Invitaciones pendientes"
      columns={PENDING_COLUMNS}
      rows={rows}
      getRowId={(invitation) => invitation.id}
      emptyMessage="No hay invitaciones pendientes."
    />
  );
}

export function AcceptedInvitationsTable({ rows }: { rows: AcceptedInvitation[] }) {
  return (
    <DataTable
      label="Invitaciones aceptadas"
      columns={ACCEPTED_COLUMNS}
      rows={rows}
      getRowId={(invitation) => invitation.id}
      emptyMessage="Cuando alguien acepte una invitación aparecerá aquí con su salón y plan."
    />
  );
}
