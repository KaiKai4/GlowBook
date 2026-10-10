"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Link2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { reactivateEmployeeAction } from "./actions-profile";
import type { EmployeeListItem } from "./types";

interface EmployeesGridProps {
  employees: EmployeeListItem[];
  totalEmployees: number;
  isArchived: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function EmployeesGrid({
  employees,
  totalEmployees,
  isArchived,
  hasActiveFilters,
  onClearFilters,
}: EmployeesGridProps) {
  const router = useRouter();
  const toast = useToast();
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [reactivateError, setReactivateError] = useState<string | null>(null);
  const [reactivationPending, startReactivation] = useTransition();

  function handleReactivateEmployee(employeeId: string) {
    setReactivatingId(employeeId);
    startReactivation(async () => {
      const res = await reactivateEmployeeAction(employeeId);
      setReactivatingId(null);
      if (res.ok) {
        toast.success("Colaborador reactivado.");
        router.refresh();
      } else {
        setReactivateError(res.error ?? "No se pudo reactivar el colaborador.");
      }
    });
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-surface py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Users className="h-5 w-5 text-brand-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-fg-subtle">
          {totalEmployees === 0 ? "Aun no hay colaboradores." : "No hay coincidencias."}
        </p>
        {hasActiveFilters ? (
          <button onClick={onClearFilters} className="mt-2 text-xs text-brand-600 hover:underline">
            Limpiar filtros
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {employees.map((employee) => {
        const card = (
          <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-brand-hover">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-choco-100 text-sm font-semibold text-brand-700">
              {`${employee.first_name[0] ?? ""}${employee.last_name[0] ?? ""}`.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-fg">
                  {employee.first_name} {employee.last_name}
                </p>
                {!employee.is_active && <StatusBadge variant="neutral" label="Inactivo" className="ml-1" />}
              </div>
              <p className="truncate text-xs text-fg-subtle">
                {employee.categories.length > 0 ? employee.categories.join(" · ") : "Sin categorías"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-brand-600">{employee.serviceCount} servicios</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {isArchived ? (
                <Button
                  variant="primary"
                  className="h-8 px-3 text-xs"
                  loading={reactivatingId === employee.id}
                  disabled={reactivationPending}
                  onClick={() => handleReactivateEmployee(employee.id)}
                >
                  Reactivar
                </Button>
              ) : (
                <>
                  {employee.profile_id ? (
                    <span title="Con acceso al sistema"><ShieldCheck className="h-4 w-4 text-success" /></span>
                  ) : (
                    <span title="Sin acceso al sistema"><Link2 className="h-4 w-4 text-fg-disabled" /></span>
                  )}
                  <ChevronRight className="h-4 w-4 text-fg-disabled transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </div>
          </div>
        );

        return isArchived ? (
          <div key={employee.id} className="group">
            {card}
          </div>
        ) : (
          <Link key={employee.id} href={`/employees/${employee.id}`} className="group">
            {card}
          </Link>
        );
      })}
    </div>

    <Dialog
      open={reactivateError !== null}
      onClose={() => setReactivateError(null)}
      title="No se pudo reactivar"
      className="max-w-sm"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2.5 text-sm text-danger-strong">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{reactivateError}</p>
          </div>
        </div>
        <Button variant="primary" className="w-full" onClick={() => setReactivateError(null)}>
          Entendido
        </Button>
      </div>
    </Dialog>
    </>
  );
}
