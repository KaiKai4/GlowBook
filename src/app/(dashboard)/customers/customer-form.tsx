"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Result } from "@/lib/result";

interface CustomerFormProps<T> {
  action: (prev: Result<T> | null, formData: FormData) => Promise<Result<T>>;
  submitLabel: string;
  defaults?: {
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    email?: string | null;
    birth_date?: string | null;
    notes?: string;
  };
}

export function CustomerForm<T>({ action, submitLabel, defaults }: CustomerFormProps<T>) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push("/customers");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <Input name="first_name" label="Nombre" defaultValue={defaults?.first_name} required />
        <Input name="last_name" label="Apellido" defaultValue={defaults?.last_name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="phone" label="Teléfono" type="tel" defaultValue={defaults?.phone ?? ""} />
        <Input name="email" label="Email" type="email" defaultValue={defaults?.email ?? ""} />
      </div>
      <Input name="birth_date" label="Fecha de nacimiento" type="date" defaultValue={defaults?.birth_date ?? ""} />
      <Textarea name="notes" label="Notas" defaultValue={defaults?.notes ?? ""} />

      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/customers")}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
