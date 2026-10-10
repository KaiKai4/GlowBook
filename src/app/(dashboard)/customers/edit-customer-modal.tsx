"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeOptionalPhoneInput } from "@/infra/format/phone";
import { AlertTriangle, UserPen } from "lucide-react";
import { deleteCustomerAction, updateCustomerAction } from "./actions";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email?: string | null;
  notes: string | null;
}

interface EditCustomerModalProps {
  customer: Customer;
  open: boolean;
  onClose: () => void;
}

export function EditCustomerModal({ customer, open, onClose }: EditCustomerModalProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(customer.first_name);
  const [lastName, setLastName] = useState(customer.last_name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  function handleClose() {
    if (pending || deleting) return;
    setConfirmDeleteOpen(false);
    onClose();
  }

  function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("first_name", firstName.trim());
    formData.set("last_name", lastName.trim());
    if (phone.trim()) formData.set("phone", phone.trim());
    if (email.trim()) formData.set("email", email.trim());
    formData.set("notes", notes.trim());
    start(async () => {
      const result = await updateCustomerAction(customer.id, null, formData);
      if (result.ok) {
        handleClose();
        router.refresh();
      } else {
        setError(result.error ?? "Error al actualizar el cliente.");
      }
    });
  }

  function handleDelete() {
    setError(null);
    setArchiveError(null);
    setConfirmDeleteOpen(true);
  }

  function handleConfirmDelete() {
    setArchiveError(null);
    startDelete(async () => {
      const result = await deleteCustomerAction(customer.id);
      if (!result.ok) {
        // El error se muestra dentro de la confirmación: el diálogo de edición queda debajo.
        setArchiveError(result.error ?? "Error al eliminar el cliente.");
        return;
      }

      setConfirmDeleteOpen(false);
      onClose();
      router.refresh();
    });
  }

  const customerName = `${customer.first_name} ${customer.last_name}`.trim();

  return (
    <>
      <Dialog open={open} onClose={handleClose} title="Editar cliente" description="Actualiza los datos del cliente." className="max-w-sm">
        <div className="space-y-4">
          <div className="flex justify-center pb-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand-sm">
              <UserPen className="h-5 w-5 text-surface" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(null); }} placeholder="Maria" autoFocus />
            <Input label="Apellido" value={lastName} onChange={(e) => { setLastName(e.target.value); setError(null); }} placeholder="Garcia" />
          </div>

          <Input
            label="Celular"
            type="tel"
            inputMode="numeric"
            maxLength={14}
            value={phone}
            onChange={(e) => {
              setPhone(normalizeOptionalPhoneInput(e.target.value));
              setError(null);
            }}
            placeholder="60000000"
          />
          <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="cliente@email.com" />

          <Textarea label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, preferencias, observaciones..." rows={3} />

          {error && (
            <div className="rounded-lg bg-danger-subtle border border-danger-border px-3 py-2.5 text-sm text-danger-strong">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="destructive" className="flex-1" onClick={handleDelete} loading={deleting} disabled={pending}>
              Eliminar
            </Button>
            <Button variant="ghost" className="flex-1" onClick={handleClose} disabled={pending || deleting}>Cancelar</Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit} loading={pending} disabled={deleting}>Guardar cambios</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmDeleteOpen}
        onClose={() => {
          if (!deleting) setConfirmDeleteOpen(false);
        }}
        title="Archivar cliente"
        description="El historial se conserva para trazabilidad."
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-danger-border-subtle bg-danger-subtle px-3 py-3 text-danger-strong">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">¿Quieres archivar a {customerName}?</p>
              <p className="mt-1 text-sm text-danger">
                El cliente saldra de la lista activa, pero sus citas e historial seguiran disponibles.
              </p>
            </div>
          </div>

          {archiveError && (
            <div role="alert" className="rounded-lg bg-danger-subtle border border-danger-border px-3 py-2.5 text-sm text-danger-strong">{archiveError}</div>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleting}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirmDelete}
              loading={deleting}
            >
              Archivar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
