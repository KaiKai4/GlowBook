"use client";

import { useState, useTransition } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { changeEmployeeRoleAction, resetEmployeeAccessAction } from "../actions";
import { EmployeeInviteLinkCard } from "../employee-invite-link-card";
import type { PendingEmployeeInvitation, RoleOption } from "../types";

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
  const [resetInvitation, setResetInvitation] = useState<PendingEmployeeInvitation | null>(null);

  const roleDirty = roleId !== (currentRoleId ?? "");
  const resetInviteUrl = resetInvitation
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${resetInvitation.token}`
    : null;

  function handleRoleSave() {
    setRoleError(null);
    startRoleSave(async () => {
      const res = await changeEmployeeRoleAction(profileId, roleId || null);
      if (res.ok) setRoleSaved(true);
      else setRoleError(res.error);
    });
  }

  function handleResetAccess() {
    setRoleError(null);
    startReset(async () => {
      const res = await resetEmployeeAccessAction(employeeId, roleId || currentRoleId || null);
      if (res.ok) {
        setResetInvitation({
          token: res.value.token,
          expiresAt: res.value.expiresAt,
          roleId: roleId || currentRoleId || null,
        });
      } else {
        setRoleError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800">Acceso activo</p>
        <span className="ml-auto text-xs text-emerald-600">Este colaborador puede iniciar sesion.</span>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-stone-600">Rol asignado</label>
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

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">Reiniciar acceso</p>
        <p className="mt-1 text-xs text-amber-700">
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

      {resetInvitation && resetInviteUrl && (
        <EmployeeInviteLinkCard url={resetInviteUrl} title="Nuevo enlace generado" />
      )}

      {roleSaved && !roleDirty && (
        <p className="flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Rol actualizado
        </p>
      )}
      {roleError && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{roleError}</p>
      )}
    </div>
  );
}
