"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield, Lock, Trash2, Plus,
  CalendarCheck, Users, Bell, BarChart3, Settings,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUnsavedChanges } from "@/components/layout/unsaved-changes";
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

const PERMISSION_GROUPS = [
  {
    group: "Citas",
    icon: CalendarCheck,
    items: [
      { key: "appointments.view", label: "Ver el calendario y sus citas", description: "Acceso de solo lectura: ve su calendario con las citas asignadas, sin poder crear ni editar" },
      { key: "appointments.manage", label: "Crear y gestionar citas", description: "Agendar, editar, confirmar, completar y cancelar citas" },
      { key: "appointments.view_all", label: "Ver todas las citas del salón", description: "Complemento de los permisos de citas: sin esto, el colaborador solo ve las citas donde está asignado" },
    ],
  },
  {
    group: "Clientes",
    icon: Users,
    items: [
      { key: "customers.manage", label: "Gestionar clientes", description: "Crear, editar y consultar la ficha de clientes" },
    ],
  },
  {
    group: "Recordatorios",
    icon: Bell,
    items: [
      { key: "reminders.send", label: "Enviar recordatorios", description: "Enviar mensajes de recordatorio a los clientes" },
    ],
  },
  {
    group: "Reportes",
    icon: BarChart3,
    items: [
      { key: "reports.view", label: "Ver reportes e indicadores", description: "Acceder al dashboard y métricas del salón" },
    ],
  },
  {
    group: "Operación comercial",
    icon: ShoppingBag,
    items: [
      { key: "retail.manage", label: "Gestionar vitrina", description: "Registrar ventas de productos y cobrar vitrina" },
      { key: "inventory.manage", label: "Gestionar inventario", description: "Crear productos, reponer stock y registrar movimientos" },
      { key: "expenses.manage", label: "Gestionar gastos", description: "Registrar egresos operativos del salón" },
    ],
  },
  {
    group: "Configuración",
    icon: Settings,
    items: [
      { key: "employees.manage", label: "Gestionar colaboradores", description: "Crear, editar y dar acceso a colaboradores" },
      { key: "services.manage", label: "Gestionar servicios", description: "Crear y editar categorías y servicios del catálogo" },
      { key: "roles.manage", label: "Gestionar roles y permisos", description: "Crear roles y definir qué puede hacer cada colaborador" },
      { key: "salon.manage", label: "Editar datos del salón", description: "Nombre, dirección, horarios y configuración general" },
    ],
  },
] as const;

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
            <Icon className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-stone-400">{group}</span>
          </div>
          <div className="space-y-2 pl-5">
            {items.map((item) => {
              const checked = disabled ? true : selected.includes(item.key);
              return (
                <label
                  key={item.key}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-2 transition-colors",
                    !disabled && "cursor-pointer hover:bg-stone-50",
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
                    <span className="block text-sm font-medium text-stone-800">{item.label}</span>
                    <span className="block text-xs text-stone-400 mt-0.5">{item.description}</span>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Roles y Permisos</h1>
          <p className="text-sm text-stone-400 mt-1">Define qué puede hacer cada rol en tu salón.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo rol
        </Button>
      </div>

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
          <div className="max-h-[380px] overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/50 p-4">
            <PermissionGroupList selected={newPerms} onChange={toggleNewPerm} />
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

function RoleCard({ role }: { role: Role }) {
  const [selected, setSelected] = useState<string[]>(role.permissionKeys);
  const [saving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
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
            role.is_system ? "bg-amber-50" : "bg-brand-50"
          )}>
            <Shield className={cn("h-4 w-4", role.is_system ? "text-amber-500" : "text-brand-500")} />
          </div>
          <CardTitle className="text-base">{role.name}</CardTitle>
          {role.is_system ? (
            <Lock className="h-3.5 w-3.5 text-stone-300 ml-auto" />
          ) : (
            <button
              onClick={() => startDelete(() => { void deleteRoleAction(role.id); })}
              disabled={isDeleting}
              className="ml-auto text-stone-300 hover:text-red-500 disabled:opacity-40 transition-colors"
              aria-label="Eliminar rol"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {role.is_system ? (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
            Este rol siempre tiene todos los permisos del salón y no se puede modificar.
          </div>
        ) : (
          <>
            <PermissionGroupList selected={selected} onChange={toggle} />
            <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-4">
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
                Guardar cambios
              </Button>
              {error && <span className="text-xs text-red-600">{error}</span>}
              {saved && !dirty && <span className="text-xs text-emerald-600">Guardado</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
