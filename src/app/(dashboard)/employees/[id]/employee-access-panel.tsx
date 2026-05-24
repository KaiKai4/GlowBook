"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Copy, Check, RefreshCw, ShieldCheck, Clock, UserX } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { generateEmployeeInviteAction } from "../actions";

interface RoleOption { id: string; name: string }
interface PendingInvitation { token: string; expiresAt: string; roleId: string | null }

interface Props {
  employeeId: string;
  employeeEmail: string;
  profileId: string | null;
  initialInvitation: PendingInvitation | null;
  roles: RoleOption[];
}

export function EmployeeAccessPanel({
  employeeId,
  employeeEmail,
  profileId,
  initialInvitation,
  roles,
}: Props) {
  const [invitation, setInvitation] = useState<PendingInvitation | null>(initialInvitation);
  const [selectedRole, setSelectedRole] = useState<string>(
    initialInvitation?.roleId ?? roles[0]?.id ?? ""
  );
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = invitation
    ? `${window.location.origin}/join/${invitation.token}`
    : null;

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateEmployeeInviteAction(employeeId, selectedRole || null);
      if (res.ok) {
        setInvitation({ token: res.value.token, expiresAt: res.value.expiresAt, roleId: selectedRole || null });
      } else {
        setError(res.error);
      }
    });
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Employee already has a linked account
  if (profileId) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Acceso activo</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Este colaborador ya tiene una cuenta vinculada al salón.
          </p>
        </div>
        <Badge variant="success" className="ml-auto shrink-0">Activo</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Email indicator */}
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <span>Correo:</span>
        <span className="font-medium text-stone-700">{employeeEmail}</span>
      </div>

      {/* Role selector */}
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">Rol al unirse</label>
        {roles.length === 0 ? (
          <p className="text-xs text-stone-400">No hay roles definidos. Crea uno en <strong>Roles y Permisos</strong> primero.</p>
        ) : (
          <Select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={pending}
            className="w-full"
          >
            <option value="">Sin rol asignado</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        )}
      </div>

      {/* Pending invitation */}
      {invitation && inviteUrl && (
        <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            <p className="text-xs text-violet-700 font-medium">
              Enlace generado — expira el{" "}
              {new Date(invitation.expiresAt).toLocaleDateString("es-PA", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="h-8 flex-1 min-w-0 rounded-md border border-violet-200 bg-white px-2.5 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-text select-all"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors shrink-0",
                copied
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white border border-violet-200 text-violet-700 hover:bg-violet-50"
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
            loading={pending}
            disabled={!employeeEmail}
          >
            <Link2 className="h-3.5 w-3.5" />
            Generar enlace de acceso
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            loading={pending}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerar enlace
          </Button>
        )}

        {!employeeEmail && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <UserX className="h-3.5 w-3.5" />
            Este colaborador no tiene email registrado.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
