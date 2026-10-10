"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteEmployeeAction } from "../actions";

interface Props {
  employeeId: string;
  employeeName: string;
}

export function DeleteEmployeeButton({ employeeId, employeeName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archivedMessage, setArchivedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteEmployeeAction(employeeId);
      if (!res.ok) {
        setError(res.error ?? "No se pudo eliminar el colaborador.");
        return;
      }

      if (res.value.outcome === "archived") {
        setConfirmOpen(false);
        setArchivedMessage([res.value.message, ...(res.warnings ?? [])].join(" "));
        return;
      }

      router.push("/employees");
      router.refresh();
    });
  }

  function handleArchivedAccept() {
    router.push("/employees");
    router.refresh();
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setConfirmOpen(true)} loading={pending}>
        <Trash2 className="h-4 w-4" />
        Eliminar colaborador
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
        title="Eliminar colaborador"
        description={`Esta acción intentará eliminar a ${employeeName}. Si tiene historial, se archivará.`}
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2.5 text-sm text-warning-strong">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Si tiene citas asociadas, se archivará y conservará su información para trazabilidad.</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2.5 text-sm text-danger-strong">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} loading={pending}>
              Eliminar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={archivedMessage !== null}
        onClose={handleArchivedAccept}
        title="Colaborador archivado"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2.5 text-sm text-warning-strong">
            <div className="flex gap-2">
              <Archive className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{archivedMessage}</p>
            </div>
          </div>
          <Button variant="primary" className="w-full" onClick={handleArchivedAccept}>
            Entendido
          </Button>
        </div>
      </Dialog>
    </>
  );
}
