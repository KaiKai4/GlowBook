"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPen } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { formDataEntries, withIdempotencyKey } from "@/components/forms/form-data-intent";
import { updateEmployeeAction } from "../actions-profile";
import { CategoryServicePicker } from "../category-service-picker";
import type { CategoryOption } from "../types";

interface EmployeeForEdit {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  specialty: string;
  commission_percentage: number;
}

interface Props {
  employee: EmployeeForEdit;
  categories: CategoryOption[];
  selectedCategoryIds: string[];
  selectedServiceIds: string[];
}

export function EditEmployeeModal({
  employee,
  categories,
  selectedCategoryIds,
  selectedServiceIds,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(employee.first_name);
  const [lastName, setLastName] = useState(employee.last_name);
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [specialty, setSpecialty] = useState(employee.specialty ?? "");
  const [commission, setCommission] = useState(String(employee.commission_percentage ?? 0));
  const [categoryIds, setCategoryIds] = useState<string[]>(selectedCategoryIds);
  const [serviceIds, setServiceIds] = useState<string[]>(selectedServiceIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { submit } = useSubmissionIntent({ procedure: "employees.update" });

  function reset() {
    setFirstName(employee.first_name);
    setLastName(employee.last_name);
    setPhone(employee.phone ?? "");
    setEmail(employee.email ?? "");
    setSpecialty(employee.specialty ?? "");
    setCommission(String(employee.commission_percentage ?? 0));
    setCategoryIds(selectedCategoryIds);
    setServiceIds(selectedServiceIds);
    setError(null);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    reset();
  }

  function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }

    const formData = new FormData();
    formData.set("first_name", firstName.trim());
    formData.set("last_name", lastName.trim());
    formData.set("phone", phone.trim());
    formData.set("email", email.trim());
    formData.set("specialty", specialty.trim());
    formData.set("commission_percentage", commission || "0");
    categoryIds.forEach((id) => formData.append("category_ids", id));
    serviceIds.forEach((id) => formData.append("service_ids", id));

    setError(null);
    startTransition(async () => {
      const result = await submit(formDataEntries(formData), (idempotencyKey) =>
        updateEmployeeAction(employee.id, null, withIdempotencyKey(formData, idempotencyKey))
      );
      if (result.ok) {
        if (result.warnings?.length) toast.warning(result.warnings.join(" "));
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo actualizar el colaborador.");
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPen className="h-4 w-4" />
        Editar datos
      </Button>

      <Dialog open={open} onClose={handleClose} title="Editar colaborador" description="Actualiza datos, categorías y servicios." className="max-w-2xl" dismissible={!pending}>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nombre" value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(null); }} autoFocus />
            <Input label="Apellido" value={lastName} onChange={(e) => { setLastName(e.target.value); setError(null); }} />
            <Input label="Teléfono" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} />
            <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} />
            <Input label="Especialidad" value={specialty} onChange={(e) => { setSpecialty(e.target.value); setError(null); }} />
            <Input label="Comisión (%)" type="number" min={0} max={100} value={commission} onChange={(e) => { setCommission(e.target.value); setError(null); }} />
          </div>

          <CategoryServicePicker
            categories={categories}
            categoryIds={categoryIds}
            serviceIds={serviceIds}
            onCategoryIdsChange={setCategoryIds}
            onServiceIdsChange={setServiceIds}
          />

          {error && (
            <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={pending}>Cancelar</Button>
            <Button variant="primary" onClick={handleSubmit} loading={pending}>Guardar cambios</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
