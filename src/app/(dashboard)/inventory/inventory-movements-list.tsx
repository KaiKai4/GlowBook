import {
  INVENTORY_LOCATION_LABELS,
} from "@/features/inventory/domain/stock";
import type { InventoryPageView } from "@/features/inventory/use-cases/inventory-products";

type InventoryMovementsListProps = {
  movements: InventoryPageView["recentMovements"];
};

export function InventoryMovementsList({ movements }: InventoryMovementsListProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-fg">Movimientos recientes</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {movements.map((movement) => (
          <div
            key={movement.id}
            className="grid gap-2 border-b border-border-subtle px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_140px_120px_160px]"
          >
            <div>
              <p className="font-semibold text-fg">{movement.productName}</p>
              <p className="text-xs text-fg-subtle">{movement.note || "Sin nota"}</p>
            </div>
            <span>{INVENTORY_LOCATION_LABELS[movement.location]}</span>
            <span className={movement.quantityDelta < 0 ? "text-danger" : "text-success-fg"}>
              {movement.quantityDelta > 0 ? "+" : ""}
              {movement.quantityDelta}
            </span>
            <span className="text-fg-subtle">{new Date(movement.createdAt).toLocaleString("es-PA")}</span>
          </div>
        ))}
        {movements.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-fg-subtle">Sin movimientos todavía.</p>
        )}
      </div>
    </section>
  );
}
