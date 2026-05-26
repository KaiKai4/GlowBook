"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Filter, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { EmployeeCreateDialog } from "./employee-create-dialog";
import { EmployeesGrid } from "./employees-grid";
import type { CategoryOption, EmployeeListItem, RoleOption } from "./types";

export function EmployeesManager({
  employees,
  categories,
  roles,
  mode,
}: {
  employees: EmployeeListItem[];
  categories: CategoryOption[];
  roles: RoleOption[];
  mode: "active" | "archived";
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCatId, setFilterCatId] = useState<string | null>(null);
  const isArchived = mode === "archived";

  const filteredEmployees = useMemo(() => {
    const query = search.toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !search ||
        employee.first_name.toLowerCase().includes(query) ||
        employee.last_name.toLowerCase().includes(query) ||
        employee.categories.some((category) => category.toLowerCase().includes(query));
      const matchesCategory = !filterCatId || employee.categoryIds.includes(filterCatId);
      return matchesSearch && matchesCategory;
    });
  }, [employees, search, filterCatId]);

  function clearFilters() {
    setSearch("");
    setFilterCatId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Colaboradores</h1>
          <p className="mt-0.5 text-sm text-stone-400">
            {filteredEmployees.length} de {employees.length} colaboradores {isArchived ? "archivados" : "activos"}
          </p>
        </div>
        {!isArchived && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo colaborador
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href="/employees"
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            !isArchived
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-stone-200 text-stone-500 hover:bg-stone-50"
          )}
        >
          Activos
        </Link>
        <Link
          href="/employees?status=archived"
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            isArchived
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-stone-200 text-stone-500 hover:bg-stone-50"
          )}
        >
          Archivados
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-medium text-stone-400">
            <Filter className="h-3.5 w-3.5" /> Categoria:
          </span>
          <button
            onClick={() => setFilterCatId(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              !filterCatId
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
            )}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setFilterCatId(filterCatId === category.id ? null : category.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filterCatId === category.id
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <EmployeesGrid
        employees={filteredEmployees}
        totalEmployees={employees.length}
        isArchived={isArchived}
        hasActiveFilters={Boolean(search || filterCatId)}
        onClearFilters={clearFilters}
      />

      <EmployeeCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        roles={roles}
      />
    </div>
  );
}
