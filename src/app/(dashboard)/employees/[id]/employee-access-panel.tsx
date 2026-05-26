"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Link2, Copy, Check, RefreshCw, ShieldCheck, Clock, UserX } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { generateEmployeeInviteAction, changeEmployeeRoleAction, resetEmployeeAccessAction } from "../actions";

interface RoleOption { id: string; name: string }
interface PendingInvitation { token: string; expiresAt: string; roleId: string | null }

interface Props {
  employeeId: string;
  employeeEmail: string;
  profileId: string | null;
  currentRoleId: string | null;
  initialInvitation: PendingInvitation | null;
  roles: RoleOption[];
}

export function EmployeeAccessPanel({
  employeeId,
  employeeEmail,
  profileId,
  currentRoleId,
  initialInvitation,
  roles,
}: Props) {
  // ── State for "has account" case (role change) ──────────────────
  const [roleId, setRoleId] = useState(currentRoleId ?? "");
  const [roleSaving, startRoleSave] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [roleSaved, setRoleSaved] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [resetInvitation, setResetInvitation] = useState<PendingInvitation | null>(null);

  // ── State for "no account yet" case (invite) ────────────────────
  const [invitation, setInvitation] = useState<PendingInvitation | null>(initialInvitation);
  const [selectedRole, setSelectedRole] = useState<string>(
    initialInvitation?.roleId ?? roles[0]?.id ?? ""
  );
  const [copied, setCopied] = useState(false);
  const [invitePending, startInvite] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);

  const inviteUrl = invitation
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${invitation.token}`
    : null;
  const resetInviteUrl = resetInvitation
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${resetInvitation.token}`
    : null;

  // ── Employee already has a linked account ────────────────────────
  if (profileId) {
    const roleDirty = roleId !== (currentRoleId ?? "");
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800">Acceso activo</p>
          <span className="ml-auto text-xs text-emerald-600">Este colaborador puede iniciar sesión.</span>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Rol asignado</label>
            <Select
              value={roleId}
              onChange={(e) => { setRoleId(e.target.value); setRoleSaved(false); setRoleError(null); }}
              disabled={roleSaving}
              className="w-full"
            >
              <option value="">Sin rol</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setRoleError(null);
              startRoleSave(async () => {
                const res = await changeEmployeeRoleAction(profileId, roleId || null);
                if (res.ok) setRoleSaved(true);
                else setRoleError(res.error);
              });
            }}
            loading={roleSaving}
            disabled={!roleDirty}
          >
            Guardar
          </Button>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Reiniciar acceso</p>
          <p className="mt-1 text-xs text-amber-700">
            Revoca la cuenta actual y genera un nuevo enlace para que el colaborador cree otra contraseña.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            loading={resetPending}
            disabled={!employeeEmail}
            onClick={() => {
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
            }}
          >
            Reiniciar y generar enlace
          </Button>
        </div>

        {resetInvitation && resetInviteUrl && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3 space-y-2">
            <p className="text-xs text-brand-700 font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Nuevo enlace generado
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={resetInviteUrl}
                className="h-8 flex-1 min-w-0 rounded-md border border-brand-200 bg-white px-2.5 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-text select-all"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(resetInviteUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors shrink-0",
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50"
                )}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        {roleSaved && !roleDirty && (
          <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Rol actualizado</p>
        )}
        {roleError && (
          <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">{roleError}</p>
        )}
      </div>
    );
  }

  // ── No account yet: generate / show invite link ──────────────────
  function handleGenerate() {
    setInviteError(null);
    startInvite(async () => {
      const res = await generateEmployeeInviteAction(employeeId, selectedRole || null);
      if (res.ok) {
        setInvitation({ token: res.value.token, expiresAt: res.value.expiresAt, roleId: selectedRole || null });
      } else {
        setInviteError(res.error);
      }
    });
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <span>Correo:</span>
        <span className="font-medium text-stone-700">{employeeEmail || "—"}</span>
      </div>

      {/* Role selector */}
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">Rol al unirse</label>
        {roles.length === 0 ? (
          <p className="text-xs text-stone-400">No hay roles. Crea uno en <strong>Roles y Permisos</strong> primero.</p>
        ) : (
          <Select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={invitePending}
            className="w-full max-w-xs"
          >
            <option value="">Sin rol asignado</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        )}
      </div>

      {/* Pending invite link */}
      {invitation && inviteUrl && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3 space-y-2">
          <p className="text-xs text-brand-700 font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Enlace generado — expira el{" "}
            {new Date(invitation.expiresAt).toLocaleDateString("es-PA", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="h-8 flex-1 min-w-0 rounded-md border border-brand-200 bg-white px-2.5 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-text select-all"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors shrink-0",
                copied
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50"
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
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
            Sin email registrado — edita el colaborador primero.
          </p>
        )}
      </div>

      {inviteError && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
          {inviteError}
        </p>
      )}
    </div>
  );
}
