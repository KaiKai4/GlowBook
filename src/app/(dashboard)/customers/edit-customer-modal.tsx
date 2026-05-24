"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserPen } from "lucide-react";
import { updateCustomerAction } from "./actions";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
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
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleClose() {
    if (pending) return;
    onClose();
  }

  function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("first_name", firstName.trim());
    fd.set("last_name", lastName.trim());
    if (phone.trim()) fd.set("phone", phone.trim());
    fd.set("notes", notes.trim());
    start(async () => {
      const res = await updateCustomerAction(customer.id, null, fd);
      if (res.ok) { handleClose(); router.refresh(); }
      else setError(res.error ?? "Error al actualizar el cliente.");
    });
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Editar cliente" description="Actualiza los datos del cliente." className="max-w-sm">
      <div className="space-y-4">
        <div className="flex justify-center pb-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-[0_4px_14px_rgba(124,58,237,0.35)]">
            <UserPen className="h-5 w-5 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(null); }} placeholder="María" autoFocus />
          <Input label="Apellido" value={lastName} onChange={(e) => { setLastName(e.target.value); setError(null); }} placeholder="García" />
        </div>

        <Input label="Teléfono" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} placeholder="+507 6000-0000" />

        <Textarea label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, preferencias, observaciones..." rows={3} />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={handleClose} disabled={pending}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit} loading={pending}>Guardar cambios</Button>
        </div>
      </div>
    </Dialog>
  );
}
