"use client";

import { useState, useTransition } from "react";
import { Link2, RefreshCw, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { generateEmployeeInviteAction } from "../actions";
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
  const [selectedRole, setSelectedRole] = useState<string>(
    initialInvitation?.roleId ?? roles[0]?.id ?? ""
  );
  const [invitePending, startInvite] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);

  function handleGenerate() {
    setInviteError(null);
    startInvite(async () => {
      const res = await generateEmployeeInviteAction(employeeId, selectedRole || null);
      if (res.ok) {
        setInvitation({
          expiresAt: res.value.expiresAt,
          roleId: selectedRole || null,
        });
        setFreshLink({
          url: `${window.location.origin}/join/${res.value.token}`,
          expiresAt: res.value.expiresAt,
        });
      } else {
        setInviteError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <span>Correo:</span>
        <span className="font-medium text-stone-700">{employeeEmail || "-"}</span>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-stone-600">Rol al unirse</label>
        {roles.length === 0 ? (
          <p className="text-xs text-stone-400">No hay roles. Crea uno en <strong>Roles y Permisos</strong> primero.</p>
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
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
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
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <UserX className="h-3.5 w-3.5" />
            Sin email registrado. Edita el colaborador primero.
          </p>
        )}
      </div>

      {inviteError && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {inviteError}
        </p>
      )}
    </div>
  );
}
