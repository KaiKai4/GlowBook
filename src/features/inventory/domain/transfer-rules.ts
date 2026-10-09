// Reglas puras de transferencia de stock entre ubicaciones (sin I/O).

/**
 * Un producto que no esta habilitado para vitrina solo puede salir de bodega
 * hacia uso interno; el resto de destinos (vitrina) requiere la bandera.
 */
export function canTransferToLocation(
  product: { isRetailEnabled: boolean },
  toLocation: string
): boolean {
  return product.isRetailEnabled || toLocation === "internal";
}
