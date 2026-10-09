import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";

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
    <PageHeader
      title="Servicios"
      description="Catalogo del salon por categorías"
      actions={
        <>
          <MetricCard label="categorías" value={categoryCount} help="0 inact." />
          <MetricCard label="servicios" value={serviceCount} help={`${inactiveServiceCount} inact.`} />
          <Button variant="primary" onClick={onCreateService} disabled={!canCreateService}>
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </Button>
        </>
      }
    />
  );
}
