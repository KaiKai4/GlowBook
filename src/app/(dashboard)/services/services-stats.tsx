import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

function Metric({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-4 py-2 text-center">
      <p className="text-xl font-semibold leading-none text-fg">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {label}
      </p>
      <p className="text-xs text-fg-subtle">{sub}</p>
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
        <h1 className="text-2xl font-semibold text-fg">Servicios</h1>
        <p className="mt-1 text-sm text-fg-subtle">Catalogo del salon por categorías</p>
      </div>
      <div className="flex items-center gap-3">
        <Metric value={categoryCount} label="categorías" sub="0 inact." />
        <Metric value={serviceCount} label="servicios" sub={`${inactiveServiceCount} inact.`} />
        <Button variant="primary" onClick={onCreateService} disabled={!canCreateService}>
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>
    </div>
  );
}
