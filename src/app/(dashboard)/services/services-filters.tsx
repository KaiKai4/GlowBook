import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { ServiceStatusFilter } from "./services-types";

export function ServicesFilters({
  query,
  statusFilter,
  onQueryChange,
  onStatusFilterChange,
}: {
  query: string;
  statusFilter: ServiceStatusFilter;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: ServiceStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar servicio..."
          className="h-9 w-full rounded-lg border border-border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div className="min-w-[180px]">
        <Select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as ServiceStatusFilter)}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </Select>
      </div>
    </div>
  );
}
