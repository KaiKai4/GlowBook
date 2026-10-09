"use client";

import { useState, useTransition } from "react";
import { Power, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateSalonStatusAction } from "../actions";

interface Props {
  salonId: string;
  salonName: string;
  isActive: boolean;
}

export function SalonStatusControl({ salonId, salonName, isActive }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextActive = !isActive;

  function submit() {
    setMessage(null);
    const actionLabel = nextActive ? "reactivar" : "suspender";
    const confirmed = window.confirm(`Vas a ${actionLabel} "${salonName}".`);
    if (!confirmed) return;

    startTransition(async () => {
      const result = await updateSalonStatusAction(salonId, nextActive);
      setMessage(result.ok ? "Actualizado" : result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={isActive ? "outline" : "primary"}
        loading={isPending}
        onClick={submit}
      >
        {isActive ? <Power className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
        {isActive ? "Suspender" : "Reactivar"}
      </Button>
      {message ? <p className="max-w-[160px] text-right text-xs text-fg-subtle">{message}</p> : null}
    </div>
  );
}
