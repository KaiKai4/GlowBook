"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-stone-900">
          No se pudo cargar esta seccion
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Intenta nuevamente. Si el problema continua, revisa tu conexion o vuelve a iniciar sesion.
        </p>
        <Button type="button" variant="outline" className="mt-5" onClick={unstable_retry}>
          <RotateCcw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
