import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

function Metric({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white px-4 py-2 text-center">
      <p className="text-xl font-bold leading-none text-neutral-900">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="text-[10px] text-neutral-400">{sub}</p>
    </div>
  );
}

export function ServicesStats({
  categoryCount,
  serviceCount,
  inactiveServiceCount,
  canCreateService,
  onCreateService,
}: {
  categoryCount: number;
  serviceCount: number;
  inactiveServiceCount: number;
  canCreateService: boolean;
  onCreateService: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Servicios</h1>
        <p className="mt-1 text-sm text-neutral-500">Catalogo del salon por categorias</p>
      </div>
      <div className="flex items-center gap-3">
        <Metric value={categoryCount} label="categorias" sub="0 inact." />
        <Metric value={serviceCount} label="servicios" sub={`${inactiveServiceCount} inact.`} />
        <Button variant="primary" onClick={onCreateService} disabled={!canCreateService}>
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>
    </div>
  );
}
