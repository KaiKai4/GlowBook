"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteRoleAction } from "./actions";

// Botón de eliminar un rol personalizado con confirmación. El error de la
// acción se muestra dentro del diálogo; si tiene éxito, el rol desaparece al revalidar.
export function RoleDeleteButton({ roleId, roleName }: { roleId: string; roleName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    startDelete(async () => {
      const result = await deleteRoleAction(roleId);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={pending}
        className="ml-auto text-fg-disabled hover:text-danger disabled:opacity-40 transition-colors"
        aria-label="Eliminar rol"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <Dialog
        open={open}
        onClose={close}
        title="Eliminar rol"
        description="Los colaboradores con este rol quedarán sin rol."
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-danger-border-subtle bg-danger-subtle px-3 py-3 text-danger-strong">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">¿Quieres eliminar el rol {roleName}? Esta acción no se puede deshacer.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleConfirm} loading={pending}>
              Eliminar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
