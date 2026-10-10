"use client";

import { useState, useTransition } from "react";
import { Link2, RefreshCw, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { generateEmployeeInviteAction } from "../actions-access";
import { EmployeeInviteLinkCard } from "../employee-invite-link-card";
import type { PendingEmployeeInvitation, RoleOption } from "../types";

interface PendingEmployeeAccessPanelProps {
  employeeId: string;
  employeeEmail: string;
  initialInvitation: PendingEmployeeInvitation | null;
  roles: RoleOption[];
}

export function PendingEmployeeAccessPanel({
  employeeId,
  employeeEmail,
  initialInvitation,
  roles,
}: PendingEmployeeAccessPanelProps) {
  const [invitation, setInvitation] = useState<PendingEmployeeInvitation | null>(initialInvitation);
  // El enlace en claro solo existe recien generado: la DB guarda el hash, asi
  // que una invitacion previa se muestra como metadatos + boton de regenerar.
  const [freshLink, setFreshLink] = useState<{ url: string; expiresAt: string } | null>(null);
  // Una invitación existente conserva su rol, incluido "sin rol" (""): no se reemplaza
  // por el primer rol del salón. El primer rol solo es valor inicial sin invitación previa.
  const [selectedRole, setSelectedRole] = useState<string>(
    initialInvitation ? (initialInvitation.roleId ?? "") : (roles[0]?.id ?? "")
  );
  const [invitePending, startInvite] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);

  function handleGenerate() {
    setInviteError(null);
    startInvite(async () => {
      const result = await generateEmployeeInviteAction(employeeId, selectedRole || null);
      if (result.ok) {
        setInvitation({
          expiresAt: result.value.expiresAt,
          roleId: selectedRole || null,
        });
        setFreshLink({
          url: `${window.location.origin}/join/${result.value.token}`,
          expiresAt: result.value.expiresAt,
        });
      } else {
        setInviteError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-fg-subtle">
        <span>Correo:</span>
        <span className="font-medium text-fg-secondary">{employeeEmail || "-"}</span>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-fg-muted">Rol al unirse</label>
        {roles.length === 0 ? (
          <p className="text-xs text-fg-subtle">No hay roles. Crea uno en <strong>Roles y Permisos</strong> primero.</p>
        ) : (
          <Select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            disabled={invitePending}
            className="w-full max-w-xs"
          >
            <option value="">Sin rol asignado</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </Select>
        )}
      </div>

      {freshLink ? (
        <EmployeeInviteLinkCard url={freshLink.url} title="Enlace generado" expiresAt={freshLink.expiresAt} />
      ) : invitation ? (
        <div className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-xs text-fg-subtle">
          Hay un enlace activo que expira el{" "}
          {new Date(invitation.expiresAt).toLocaleDateString("es-PA", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Por seguridad no puede volver a mostrarse; si se perdió, regenera uno nuevo (el anterior queda invalidado).
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {!invitation ? (
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            loading={invitePending}
            disabled={!employeeEmail}
          >
            <Link2 className="h-3.5 w-3.5" />
            Generar enlace de acceso
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleGenerate} loading={invitePending}>
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerar enlace
          </Button>
        )}

        {!employeeEmail && (
          <p className="flex items-center gap-1.5 text-xs text-warning-fg">
            <UserX className="h-3.5 w-3.5" />
            Sin email registrado. Edita el colaborador primero.
          </p>
        )}
      </div>

      {inviteError && (
        <p className="rounded-lg border border-danger-border-subtle bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
          {inviteError}
        </p>
      )}
    </div>
  );
}
