"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Trash2, Plus } from "lucide-react";
import {
  createRoleAction,
  updateRolePermissionsAction,
  deleteRoleAction,
} from "./actions";

interface Permission { id: string; key: string; description: string }
interface Role {
  id: string;
  name: string;
  is_system: boolean;
  permissionKeys: string[];
}

export function RolesManager({
  roles,
  allPermissions,
}: {
  roles: Role[];
  allPermissions: Permission[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [creating, startCreate] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    formData.set("permission_keys", JSON.stringify(newPerms));
    setCreateError(null);
    startCreate(async () => {
      const res = await createRoleAction(null, formData);
      if (res.ok) {
        setCreateOpen(false);
        setNewPerms([]);
      } else {
        setCreateError(res.error);
      }
    });
  }

  function toggleNewPerm(key: string) {
    setNewPerms((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Roles y Permisos</h1>
          <p className="text-sm text-neutral-500 mt-1">Define qué puede hacer cada rol en tu salón.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo rol
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} allPermissions={allPermissions} />
        ))}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo rol"
        description="Asigna los permisos que tendrá este rol."
      >
        <form action={handleCreate} className="space-y-4">
          <Input name="name" label="Nombre del rol" placeholder="Estilista Senior" required />
          <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border border-neutral-100 p-3">
            {allPermissions.map((p) => (
              <label key={p.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newPerms.includes(p.key)}
                  onChange={() => toggleNewPerm(p.key)}
                  className="mt-0.5 rounded"
                />
                <span>
                  <span className="font-mono text-xs text-neutral-900">{p.key}</span>
                  <span className="block text-xs text-neutral-500">{p.description}</span>
                </span>
              </label>
            ))}
          </div>
          {createError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={creating}>Crear rol</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function RoleCard({ role, allPermissions }: { role: Role; allPermissions: Permission[] }) {
  const [selected, setSelected] = useState<string[]>(role.permissionKeys);
  const [saving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    selected.length !== role.permissionKeys.length ||
    selected.some((k) => !role.permissionKeys.includes(k));

  function toggle(key: string) {
    setSaved(false);
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("role_id", role.id);
    fd.set("permission_keys", JSON.stringify(selected));
    setError(null);
    startSave(async () => {
      const res = await updateRolePermissionsAction(null, fd);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-rose-600" />
          <CardTitle>{role.name}</CardTitle>
          {role.is_system ? (
            <Lock className="h-3.5 w-3.5 text-neutral-400 ml-auto" />
          ) : (
            <button
              onClick={() => startDelete(() => { void deleteRoleAction(role.id); })}
              disabled={isDeleting}
              className="ml-auto text-neutral-400 hover:text-red-600 disabled:opacity-50"
              aria-label="Eliminar rol"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {allPermissions.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={role.is_system ? true : selected.includes(p.key)}
                onChange={() => toggle(p.key)}
                disabled={role.is_system}
                className="rounded disabled:opacity-50"
              />
              <span className="font-mono text-xs">{p.key}</span>
            </label>
          ))}
        </div>
        {role.is_system ? (
          <p className="text-xs text-neutral-400">Rol de sistema — siempre tiene todos los permisos.</p>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
              Guardar
            </Button>
            {error && <span className="text-xs text-red-600">{error}</span>}
            {saved && !dirty && <span className="text-xs text-emerald-600">Guardado</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
