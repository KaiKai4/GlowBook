"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { assignRoleAction } from "../roles/actions";

interface Member { id: string; full_name: string; is_owner: boolean; role_id: string | null }
interface RoleOption { id: string; name: string }

export function TeamManager({ members, roles }: { members: Member[]; roles: RoleOption[] }) {
  return (
    <div className="space-y-2">
      {members.map((m) => (
        <MemberRow key={m.id} member={m} roles={roles} />
      ))}
    </div>
  );
}

function MemberRow({ member, roles }: { member: Member; roles: RoleOption[] }) {
  const [roleId, setRoleId] = useState(member.role_id ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onChange(value: string) {
    setRoleId(value);
    setMsg(null);
    const fd = new FormData();
    fd.set("profile_id", member.id);
    fd.set("role_id", value);
    start(async () => {
      const res = await assignRoleAction(null, fd);
      setMsg(res.ok ? "Rol actualizado" : res.error);
    });
  }

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 flex items-center gap-2">
              {member.full_name || "Sin nombre"}
              {member.is_owner && <Badge variant="primary">Owner</Badge>}
            </p>
            {msg && <p className="text-xs text-neutral-500 mt-0.5">{msg}</p>}
          </div>
          <div className="w-48 shrink-0">
            {member.is_owner ? (
              <span className="text-sm text-neutral-400">Todos los permisos</span>
            ) : (
              <Select value={roleId} onChange={(e) => onChange(e.target.value)} disabled={pending}>
                <option value="">Sin rol</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
