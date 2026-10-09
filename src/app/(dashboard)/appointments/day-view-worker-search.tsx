"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import type { CalendarEmployee } from "@/features/appointments/view-models";
import { filterEmployeesByName } from "./day-view-data";

export function WorkerSearchBar({
  employees,
  selectedEmpId,
  selectedEmp,
  onSelect,
}: {
  employees: CalendarEmployee[];
  selectedEmpId: string | null;
  selectedEmp: CalendarEmployee | undefined;
  onSelect: (employeeId: string | null) => void;
}) {
  const [empSearch, setEmpSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const filteredEmps = filterEmployeesByName(employees, empSearch);

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-surface shadow-sm px-4 py-3">
        <Search className="h-4 w-4 text-fg-subtle shrink-0" />
        <input
          type="text"
          placeholder="Buscar profesional por nombre..."
          value={selectedEmp
            ? `${selectedEmp.first_name} ${selectedEmp.last_name}`
            : empSearch}
          onChange={(e) => {
            if (selectedEmpId) onSelect(null);
            setEmpSearch(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          className="flex-1 text-sm text-fg-secondary placeholder:text-fg-subtle outline-none bg-transparent"
        />
        {selectedEmpId ? (
          <button
            onClick={() => { onSelect(null); setEmpSearch(""); }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-sunken text-fg-muted hover:bg-danger-subtle hover:text-danger-strong transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-xs text-fg-subtle">{employees.length} profesionales</span>
        )}
      </div>

      {dropdownOpen && !selectedEmpId && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
          {filteredEmps.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fg-subtle">Sin resultados</p>
          ) : (
            filteredEmps.map((emp) => (
              <button
                key={emp.id}
                className="w-full text-left px-4 py-2.5 text-sm text-fg-secondary hover:bg-brand-50 hover:text-brand-700 transition-colors"
                onMouseDown={() => {
                  onSelect(emp.id);
                  setEmpSearch("");
                  setDropdownOpen(false);
                }}
              >
                {emp.first_name} {emp.last_name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
