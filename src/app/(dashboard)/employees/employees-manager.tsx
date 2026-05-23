"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { Plus, ChevronRight, Users, Search, Filter } from "lucide-react";
import { createEmployeeAction } from "./actions";

interface EmployeeListItem {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  serviceCount: number;
  categories: string[];
  categoryIds: string[];
}

interface CategoryOption {
  id: string;
  name: string;
  services: { id: string; name: string }[];
}

export function EmployeesManager({
  employees,
  categories,
}: {
  employees: EmployeeListItem[];
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCatId, setFilterCatId] = useState<string | null>(null);

  function reset() {
    setSelectedCats([]);
    setError(null);
  }

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createEmployeeAction(null, formData);
      if (res.ok) {
        setOpen(false);
        reset();
      } else {
        setError(res.error);
      }
    });
  }

  function toggleCat(id: string) {
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const selectedCategoryObjs = categories.filter((c) => selectedCats.includes(c.id));

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      emp.first_name.toLowerCase().includes(q) ||
      emp.last_name.toLowerCase().includes(q) ||
      emp.categories.some((c) => c.toLowerCase().includes(q));
    const matchCat = !filterCatId || emp.categoryIds.includes(filterCatId);
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Colaboradores</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {filtered.length} de {employees.length} colaboradores
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo colaborador
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-medium text-stone-400">
            <Filter className="h-3.5 w-3.5" /> Categoría:
          </span>
          <button
            onClick={() => setFilterCatId(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              !filterCatId
                ? "border-violet-400 bg-violet-50 text-violet-700"
                : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
            )}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCatId(filterCatId === cat.id ? null : cat.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filterCatId === cat.id
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Employee grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-200 bg-white py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
            <Users className="h-5 w-5 text-violet-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-stone-500">
            {employees.length === 0 ? "Aún no hay colaboradores." : "No hay coincidencias."}
          </p>
          {search || filterCatId ? (
            <button
              onClick={() => { setSearch(""); setFilterCatId(null); }}
              className="mt-2 text-xs text-violet-600 hover:underline"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((emp) => (
            <Link key={emp.id} href={`/employees/${emp.id}`} className="group">
              <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_16px_rgba(124,58,237,0.12)] hover:-translate-y-0.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-choco-100 text-sm font-bold text-violet-700">
                  {`${emp.first_name[0] ?? ""}${emp.last_name[0] ?? ""}`.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-stone-900">
                      {emp.first_name} {emp.last_name}
                    </p>
                    {!emp.is_active && <Badge variant="default" className="ml-1">Inactivo</Badge>}
                  </div>
                  <p className="truncate text-xs text-stone-400">
                    {emp.categories.length > 0 ? emp.categories.join(" · ") : "Sin categorías"}
                  </p>
                  <p className="mt-0.5 text-xs text-violet-500 font-medium">{emp.serviceCount} servicios</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title="Nuevo colaborador"
        description="Elige las categorías y los servicios que realiza."
        className="max-w-lg"
      >
        <form action={handleCreate} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Input name="first_name" label="Nombre" required />
            <Input name="last_name" label="Apellido" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="phone" label="Teléfono" type="tel" />
            <Input name="email" label="Email" type="email" />
          </div>
          <Input name="commission_percentage" label="Comisión (%)" type="number" min={0} max={100} defaultValue={0} />

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">1. Categorías que atiende</p>
            {categories.length === 0 ? (
              <p className="text-xs text-stone-400">No hay categorías. Crea servicios primero.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const sel = selectedCats.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCat(c.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        sel
                          ? "border-violet-400 bg-violet-50 text-violet-700"
                          : "border-stone-200 text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedCats.map((id) => (
              <input key={id} type="hidden" name="category_ids" value={id} />
            ))}
          </div>

          {selectedCategoryObjs.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-stone-700">2. Servicios que realiza</p>
              <div className="space-y-3 max-h-52 overflow-y-auto rounded-xl border border-violet-100 p-3 bg-violet-50/30">
                {selectedCategoryObjs.map((cat) => (
                  <div key={cat.id}>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-400">{cat.name}</p>
                    {cat.services.length === 0 ? (
                      <p className="mt-1 text-xs text-stone-400">Sin servicios en esta categoría.</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {cat.services.map((svc) => (
                          <label key={svc.id} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer hover:text-stone-900">
                            <input type="checkbox" name="service_ids" value={svc.id} className="rounded accent-violet-600" />
                            {svc.name}
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
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Crear colaborador
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
