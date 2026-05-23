"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Plus, Clock, Search, Scissors } from "lucide-react";
import { createCategoryAction, createServiceAction } from "./actions";

interface EmployeeBadge { id: string; initials: string; name: string }
interface ServiceItem {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  employees: EmployeeBadge[];
}
interface Category {
  id: string;
  name: string;
  services: ServiceItem[];
}

export function ServicesManager({ categories }: { categories: Category[] }) {
  const [activeCat, setActiveCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [catOpen, setCatOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState("");

  const [catPending, startCat] = useTransition();
  const [svcPending, startSvc] = useTransition();
  const [catError, setCatError] = useState<string | null>(null);
  const [svcError, setSvcError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const allServices = categories.flatMap((c) => c.services);
    return {
      categories: categories.length,
      services: allServices.length,
      inactiveCats: 0,
      inactiveServices: allServices.filter((s) => !s.is_active).length,
    };
  }, [categories]);

  const visibleCategories = useMemo(() => {
    return categories
      .filter((c) => activeCat === "all" || c.id === activeCat)
      .map((c) => ({
        ...c,
        services: c.services.filter((s) => {
          const matchesQuery = s.name.toLowerCase().includes(query.toLowerCase());
          const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" && s.is_active) ||
            (statusFilter === "inactive" && !s.is_active);
          return matchesQuery && matchesStatus;
        }),
      }))
      .filter((c) => c.services.length > 0 || activeCat === c.id);
  }, [categories, activeCat, query, statusFilter]);

  function handleCreateCategory(formData: FormData) {
    setCatError(null);
    startCat(async () => {
      const res = await createCategoryAction(null, formData);
      if (res.ok) setCatOpen(false);
      else setCatError(res.error);
    });
  }
  function handleCreateService(formData: FormData) {
    setSvcError(null);
    startSvc(async () => {
      const res = await createServiceAction(null, formData);
      if (res.ok) setSvcOpen(false);
      else setSvcError(res.error);
    });
  }
  function openNewService(categoryId?: string) {
    setDefaultCategory(categoryId ?? (activeCat !== "all" ? activeCat : categories[0]?.id ?? ""));
    setSvcOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Servicios</h1>
          <p className="text-sm text-neutral-500 mt-1">Catálogo del salón por categorías</p>
        </div>
        <div className="flex items-center gap-3">
          <Metric value={totals.categories} label="categorías" sub={`${totals.inactiveCats} inact.`} />
          <Metric value={totals.services} label="servicios" sub={`${totals.inactiveServices} inact.`} />
          <Button variant="primary" onClick={() => openNewService()} disabled={categories.length === 0}>
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar de categorías */}
        <aside>
          <div className="rounded-xl border border-neutral-100 bg-white p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Categorías</span>
              <button
                onClick={() => setCatOpen(true)}
                className="text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                + Nueva
              </button>
            </div>
            <ul className="mt-1 space-y-0.5">
              <CategoryRow
                label="Todas"
                count={totals.services}
                active={activeCat === "all"}
                onClick={() => setActiveCat("all")}
              />
              {categories.map((c) => (
                <CategoryRow
                  key={c.id}
                  label={c.name}
                  count={c.services.length}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                />
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <div className="space-y-6">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar servicio..."
                className="h-9 w-full rounded-lg border border-neutral-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          {categories.length === 0 ? (
            <EmptyState onAdd={() => setCatOpen(true)} />
          ) : (
            visibleCategories.map((cat) => (
              <section key={cat.id}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-serif text-lg italic text-neutral-800">{cat.name}</h2>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-xs font-medium text-neutral-500">
                    {cat.services.length}
                  </span>
                  <button
                    onClick={() => openNewService(cat.id)}
                    className="ml-auto text-xs text-rose-600 hover:underline"
                  >
                    + Agregar
                  </button>
                </div>
                {cat.services.length === 0 ? (
                  <p className="text-sm text-neutral-400">Sin servicios en esta categoría.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {cat.services.map((svc) => (
                      <ServiceCard key={svc.id} service={svc} />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </div>

      {/* Diálogos */}
      <Dialog open={catOpen} onClose={() => setCatOpen(false)} title="Nueva categoría">
        <form action={handleCreateCategory} className="space-y-4">
          <Input name="name" label="Nombre" placeholder="Cabello, Uñas, Barbería..." required />
          <Textarea name="description" label="Descripción (opcional)" />
          {catError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{catError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={catPending}>Crear categoría</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={svcOpen} onClose={() => setSvcOpen(false)} title="Nuevo servicio">
        <form action={handleCreateService} className="space-y-4">
          <Select name="category_id" label="Categoría" defaultValue={defaultCategory} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input name="name" label="Nombre del servicio" placeholder="Corte de cabello" required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="duration_minutes" label="Duración (min)" type="number" min={1} defaultValue={30} required />
            <Input name="price" label="Precio (USD)" type="number" min={0} step="0.01" defaultValue={0} required />
          </div>
          <Textarea name="description" label="Descripción (opcional)" />
          {svcError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{svcError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSvcOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={svcPending}>Crear servicio</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function Metric({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white px-4 py-2 text-center">
      <p className="text-xl font-bold text-neutral-900 leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-[10px] text-neutral-400">{sub}</p>
    </div>
  );
}

function CategoryRow({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
          active ? "bg-rose-50 font-medium text-rose-700" : "text-neutral-600 hover:bg-neutral-50"
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-rose-500" : "bg-neutral-300")} />
          {label}
        </span>
        <span className="text-xs text-neutral-400">{count}</span>
      </button>
    </li>
  );
}

function ServiceCard({ service }: { service: ServiceItem }) {
  return (
    <div className="group rounded-xl border border-neutral-100 bg-white p-4 transition-all hover:border-neutral-200 hover:shadow-sm">
      <p className="font-medium text-neutral-900">{service.name}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          <Clock className="h-3 w-3" />
          {service.duration_minutes} min
        </span>
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
          {formatCurrency(service.price)}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
            service.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", service.is_active ? "bg-emerald-500" : "bg-neutral-400")} />
          {service.is_active ? "Activo" : "Inactivo"}
        </span>
      </div>
      {service.employees.length > 0 && (
        <div className="mt-3 flex -space-x-1.5">
          {service.employees.slice(0, 5).map((e) => (
            <span
              key={e.id}
              title={e.name}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-violet-100 text-[10px] font-semibold text-violet-700"
            >
              {e.initials}
            </span>
          ))}
          {service.employees.length > 5 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-[10px] font-semibold text-neutral-500">
              +{service.employees.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <Scissors className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm text-neutral-500">Crea tu primera categoría para empezar.</p>
      <Button variant="primary" className="mt-4" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Nueva categoría
      </Button>
    </div>
  );
}
