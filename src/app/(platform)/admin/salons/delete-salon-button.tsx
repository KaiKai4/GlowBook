"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteSalonAction } from "../actions";

interface Props {
  salonId: string;
  salonName: string;
}

export function DeleteSalonButton({ salonId, salonName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canDelete = confirmation.trim() === salonId;

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteSalonAction(salonId, confirmation.trim());
      if (res.ok) {
        handleClose();
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo eliminar el salón.");
      }
    });
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="Eliminar salón completo"
        description={`Esta acción eliminará permanentemente "${salonName}" y todos sus datos.`}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Se borrarán citas, clientes, colaboradores, servicios, horarios, roles, invitaciones y usuarios asociados.
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
            ID del salón: <span className="font-mono font-semibold text-stone-700">{salonId}</span>
          </div>

          <Input
            label="Escribe el ID del salón para confirmar"
            value={confirmation}
            onChange={(e) => { setConfirmation(e.target.value); setError(null); }}
            placeholder={salonId}
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={pending} disabled={!canDelete}>
              Eliminar definitivamente
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
