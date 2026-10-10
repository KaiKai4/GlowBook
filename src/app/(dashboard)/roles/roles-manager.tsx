"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Shield, Lock, Plus,
  CalendarCheck, Users, Bell, BarChart3, Settings,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useUnsavedChanges } from "@/components/layout/unsaved-changes";
import type { LucideIcon } from "lucide-react";
import type { Permission as PermissionKey } from "@/features/access";
import { RoleDeleteButton } from "./delete-role-dialog";
import { PERMISSION_TEXTS } from "./permission-texts";
import {
  createRoleAction,
  updateRolePermissionsAction,
} from "./actions";

interface Permission { id: string; key: string; description: string }
interface Role {
  id: string;
  name: string;
  is_system: boolean;
  permissionKeys: string[];
}

// Grupos de la UI. Los permisos se tipan contra el catalogo; los textos viven en PERMISSION_TEXTS.
const PERMISSION_GROUPS: { group: string; icon: LucideIcon; items: PermissionKey[] }[] = [
  { group: "Citas", icon: CalendarCheck, items: ["appointments.view", "appointments.manage", "appointments.view_all"] },
  { group: "Clientes", icon: Users, items: ["customers.manage"] },
  { group: "Recordatorios", icon: Bell, items: ["reminders.send"] },
  { group: "Reportes", icon: BarChart3, items: ["reports.view"] },
  { group: "Operación comercial", icon: ShoppingBag, items: ["retail.manage", "inventory.manage", "expenses.manage"] },
  { group: "Configuración", icon: Settings, items: ["employees.manage", "services.manage", "roles.manage", "salon.manage"] },
];

type PermKey = string;

function PermissionGroupList({
  selected,
  onChange,
  disabled = false,
}: {
  selected: PermKey[];
  onChange?: (key: PermKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map(({ group, icon: Icon, items }) => (
        <div key={group}>
          <div className="flex items-center gap-1.5 mb-2">
            <Icon className="h-3.5 w-3.5 text-fg-subtle" />
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{group}</span>
          </div>
          <div className="space-y-2 pl-5">
            {items.map((permissionKey) => {
              const item = { key: permissionKey, ...PERMISSION_TEXTS[permissionKey] };
              const checked = disabled ? true : selected.includes(item.key);
              return (
                <label
                  key={item.key}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-2 transition-colors",
                    !disabled && "cursor-pointer hover:bg-surface-muted",
                    disabled && "opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange?.(item.key)}
                    disabled={disabled}
                    className="mt-0.5 h-4 w-4 rounded accent-brand-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-fg-secondary">{item.label}</span>
                    <span className="block text-xs text-fg-subtle mt-0.5">{item.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
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

  // keep allPermissions in scope for the form serialization
  void allPermissions;

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
      <PageHeader
        title="Roles y Permisos"
        description="Define qué puede hacer cada rol en tu salón."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo rol
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo rol"
        description="Elige qué puede hacer este rol en el salón."
      >
        <form action={handleCreate} className="space-y-4">
          <Input name="name" label="Nombre del rol" placeholder="Estilista, Manicurista..." required autoFocus />
          <div className="max-h-[380px] overflow-y-auto rounded-xl border border-border-subtle bg-surface-muted/50 p-4">
            <PermissionGroupList selected={newPerms} onChange={toggleNewPerm} />
          </div>
          {createError && (
            <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{createError}</p>
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

function RoleCard({ role }: { role: Role }) {
  const [selected, setSelected] = useState<string[]>(role.permissionKeys);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    selected.length !== role.permissionKeys.length ||
    selected.some((k) => !role.permissionKeys.includes(k));

  useUnsavedChanges(dirty);

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
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            role.is_system ? "bg-warning-subtle" : "bg-brand-50"
          )}>
            <Shield className={cn("h-4 w-4", role.is_system ? "text-warning" : "text-brand-500")} />
          </div>
          <CardTitle className="text-base">{role.name}</CardTitle>
          {role.is_system ? (
            <Lock className="h-3.5 w-3.5 text-fg-disabled ml-auto" />
          ) : (
            <RoleDeleteButton roleId={role.id} roleName={role.name} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {role.is_system ? (
          <div className="rounded-lg bg-warning-subtle border border-warning-border px-4 py-3 text-sm text-warning-strong">
            Este rol siempre tiene todos los permisos del salón y no se puede modificar.
          </div>
        ) : (
          <>
            <PermissionGroupList selected={selected} onChange={toggle} />
            <div className="mt-4 flex items-center gap-3 border-t border-border-subtle pt-4">
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
                Guardar cambios
              </Button>
              {error && <span className="text-xs text-danger">{error}</span>}
              {saved && !dirty && <span className="text-xs text-success-fg">Guardado</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
