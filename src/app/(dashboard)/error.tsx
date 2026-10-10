"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-danger-border-subtle bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle">
          <AlertTriangle className="h-5 w-5 text-danger" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg">
          No se pudo cargar esta sección
        </h2>
        <p className="mt-2 text-sm text-fg-subtle">
          Intenta nuevamente. Si el problema continua, revisa tu conexion o vuelve a iniciar sesion.
        </p>
        <Button type="button" variant="outline" className="mt-5" onClick={retry}>
          <RotateCcw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
