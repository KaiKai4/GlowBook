"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { UserPen } from "lucide-react";
import { updateEmployeeAction } from "../actions";

interface EmployeeForEdit {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  specialty: string;
  commission_percentage: number;
}

interface CategoryOption {
  id: string;
  name: string;
  services: { id: string; name: string }[];
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

  const selectedCategories = useMemo(
    () => categories.filter((category) => categoryIds.includes(category.id)),
    [categories, categoryIds]
  );

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

  function toggleCategory(categoryId: string) {
    setCategoryIds((prev) => {
      const next = prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId];

      const allowedServiceIds = new Set(
        categories
          .filter((category) => next.includes(category.id))
          .flatMap((category) => category.services.map((service) => service.id))
      );
      setServiceIds((current) => current.filter((serviceId) => allowedServiceIds.has(serviceId)));
      return next;
    });
  }

  function toggleService(serviceId: string) {
    setServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  }

  function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }

    const fd = new FormData();
    fd.set("first_name", firstName.trim());
    fd.set("last_name", lastName.trim());
    fd.set("phone", phone.trim());
    fd.set("email", email.trim());
    fd.set("specialty", specialty.trim());
    fd.set("commission_percentage", commission || "0");
    categoryIds.forEach((id) => fd.append("category_ids", id));
    serviceIds.forEach((id) => fd.append("service_ids", id));

    setError(null);
    startTransition(async () => {
      const res = await updateEmployeeAction(employee.id, null, fd);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo actualizar el colaborador.");
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPen className="h-4 w-4" />
        Editar datos
      </Button>

      <Dialog open={open} onClose={handleClose} title="Editar colaborador" description="Actualiza datos, categorias y servicios." className="max-w-2xl">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nombre" value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(null); }} autoFocus />
            <Input label="Apellido" value={lastName} onChange={(e) => { setLastName(e.target.value); setError(null); }} />
            <Input label="Telefono" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} />
            <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} />
            <Input label="Especialidad" value={specialty} onChange={(e) => { setSpecialty(e.target.value); setError(null); }} />
            <Input label="Comision (%)" type="number" min={0} max={100} value={commission} onChange={(e) => { setCommission(e.target.value); setError(null); }} />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">Categorias que atiende</p>
            {categories.length === 0 ? (
              <p className="text-sm text-stone-400">No hay categorias configuradas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const selected = categoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        selected
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-stone-200 text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedCategories.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-stone-700">Servicios que realiza</p>
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-brand-100 bg-brand-50/30 p-3">
                {selectedCategories.map((category) => (
                  <div key={category.id}>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-400">{category.name}</p>
                    {category.services.length === 0 ? (
                      <p className="mt-1 text-xs text-stone-400">Sin servicios en esta categoria.</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {category.services.map((service) => (
                          <label key={service.id} className="flex cursor-pointer items-center gap-2 text-sm text-stone-700 hover:text-stone-900">
                            <input
                              type="checkbox"
                              checked={serviceIds.includes(service.id)}
                              onChange={() => toggleService(service.id)}
                              className="rounded accent-brand-600"
                            />
                            {service.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
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
