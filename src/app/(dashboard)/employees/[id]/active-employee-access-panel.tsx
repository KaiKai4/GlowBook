"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { changeEmployeeRoleAction, resetEmployeeAccessAction } from "../actions-access";
import { EmployeeInviteLinkCard } from "../employee-invite-link-card";
import type { RoleOption } from "../types";

interface ActiveEmployeeAccessPanelProps {
  employeeId: string;
  employeeEmail: string;
  profileId: string;
  currentRoleId: string | null;
  roles: RoleOption[];
}

export function ActiveEmployeeAccessPanel({
  employeeId,
  employeeEmail,
  profileId,
  currentRoleId,
  roles,
}: ActiveEmployeeAccessPanelProps) {
  const [roleId, setRoleId] = useState(currentRoleId ?? "");
  const [roleSaving, startRoleSave] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [roleSaved, setRoleSaved] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  // El token en claro solo existe en la respuesta del action; se guarda la URL
  // construida para mostrarla una unica vez.
  const [resetLink, setResetLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [resetWarning, setResetWarning] = useState<string | null>(null);

  const roleDirty = roleId !== (currentRoleId ?? "");

  function handleRoleSave() {
    setRoleError(null);
    startRoleSave(async () => {
      const result = await changeEmployeeRoleAction(profileId, roleId || null);
      if (result.ok) setRoleSaved(true);
      else setRoleError(result.error);
    });
  }

  function handleResetAccess() {
    setRoleError(null);
    setResetWarning(null);
    startReset(async () => {
      // "Sin rol" debe enviarse como null: no reutilizar el rol anterior (conservaría permisos).
      const result = await resetEmployeeAccessAction(employeeId, roleId || null);
      if (result.ok) {
        setResetLink({
          url: `${window.location.origin}/join/${result.value.token}`,
          expiresAt: result.value.expiresAt,
        });
        if (result.warnings?.length) setResetWarning(result.warnings.join(" "));
      } else {
        setRoleError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-success-border-subtle bg-success-subtle px-4 py-3">
        <StatusBadge variant="success" label="Acceso activo" />
        <span className="ml-auto text-xs text-success-fg">Este colaborador puede iniciar sesión.</span>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">Rol asignado</label>
          <Select
            value={roleId}
            onChange={(event) => {
              setRoleId(event.target.value);
              setRoleSaved(false);
              setRoleError(null);
            }}
            disabled={roleSaving}
            className="w-full"
          >
            <option value="">Sin rol</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </Select>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleRoleSave}
          loading={roleSaving}
          disabled={!roleDirty}
        >
          Guardar
        </Button>
      </div>

      <div className="rounded-lg border border-warning-border bg-warning-subtle px-4 py-3">
        <p className="text-sm font-semibold text-warning-strong">Reiniciar acceso</p>
        <p className="mt-1 text-xs text-warning-fg">
          Revoca la cuenta actual y genera un nuevo enlace para que el colaborador cree otra contrasena.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          loading={resetPending}
          disabled={!employeeEmail}
          onClick={handleResetAccess}
        >
          Reiniciar y generar enlace
        </Button>
      </div>

      {resetLink && (
        <EmployeeInviteLinkCard url={resetLink.url} title="Nuevo enlace generado" expiresAt={resetLink.expiresAt} />
      )}

      {resetWarning && (
        <p className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-sm text-warning-strong">{resetWarning}</p>
      )}

      {roleSaved && !roleDirty && (
        <p className="flex items-center gap-1 text-xs text-success-fg">
          <Check className="h-3.5 w-3.5" /> Rol actualizado
        </p>
      )}
      {roleError && (
        <p className="rounded-lg border border-danger-border-subtle bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{roleError}</p>
      )}
    </div>
  );
}
