"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createEmployeeAction,
  findArchivedEmployeeByEmailAction,
  reactivateEmployeeAction,
} from "./actions";
import type {
  ArchivedEmployeeMatch,
  CreateEmployeeResult,
} from "@/features/employees/use-cases/employee-profile";
import { CategoryServicePicker } from "./category-service-picker";
import type { CategoryOption, RoleOption } from "./types";
import type { Result } from "@/lib/result";

interface EmployeeCreateFormProps {
  categories: CategoryOption[];
  roles: RoleOption[];
  onCreated: () => void;
  onCreatedWithInvite: (result: CreateEmployeeResult) => void;
}

export function EmployeeCreateForm({
  categories,
  roles,
  onCreated,
  onCreatedWithInvite,
}: EmployeeCreateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [archivedMatch, setArchivedMatch] = useState<ArchivedEmployeeMatch | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res: Result<CreateEmployeeResult> = await createEmployeeAction(null, formData);
      if (res.ok) {
        if (res.value.inviteToken) onCreatedWithInvite(res.value);
        else onCreated();
      } else {
        setError(res.error);
      }
    });
  }

  async function checkArchivedEmail(nextEmail = email) {
    const match = await findArchivedEmployeeByEmailAction(nextEmail);
    setArchivedMatch(match);
  }

  function handleReactivateEmployee(employeeId: string) {
    setReactivatingId(employeeId);
    startTransition(async () => {
      const res = await reactivateEmployeeAction(employeeId);
      setReactivatingId(null);
      if (res.ok) {
        onCreated();
        router.refresh();
      } else {
        window.alert(res.error ?? "No se pudo reactivar el colaborador.");
      }
    });
  }

  return (
    <form action={handleCreate} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Input name="first_name" label="Nombre" required />
        <Input name="last_name" label="Apellido" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="phone" label="Telefono" type="tel" />
        <Input
          name="email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setArchivedMatch(null);
            setError(null);
          }}
          onBlur={() => checkArchivedEmail()}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="commission_percentage" label="Comision (%)" type="number" min={0} max={100} defaultValue={0} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-stone-600">Rol</label>
          {roles.length === 0 ? (
            <p className="pt-1 text-xs text-stone-400">Sin roles. Crea uno en <strong>Roles</strong> primero.</p>
          ) : (
            <Select name="role_id" className="w-full">
              <option value="">Sin rol por ahora</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <CategoryServicePicker
        categories={categories}
        categoryIds={selectedCats}
        serviceIds={selectedServices}
        onCategoryIdsChange={setSelectedCats}
        onServiceIdsChange={setSelectedServices}
        renderHiddenInputs
        categoryTitle="1. Categorias que atiende"
        serviceTitle="2. Servicios que realiza"
        emptyCategoryMessage="No hay categorias. Crea servicios primero."
      />

      <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-400">
        Si ingresas email y seleccionas un rol, se generara automaticamente el enlace de acceso.
      </p>

      {archivedMatch && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <p className="font-semibold">Ya existe un colaborador archivado: {archivedMatch.name}</p>
          <p className="mt-1 text-xs">
            Reactivarlo conserva su historial. Luego puedes editar servicios, categorias, horarios y generar un nuevo enlace.
          </p>
          <Button
            type="button"
            variant="primary"
            className="mt-3 w-full"
            loading={reactivatingId === archivedMatch.id}
            onClick={() => handleReactivateEmployee(archivedMatch.id)}
          >
            Reactivar colaborador
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCreated}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={!!archivedMatch}>
          Crear colaborador
        </Button>
      </div>
    </form>
  );
}
