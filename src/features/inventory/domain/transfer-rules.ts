// Reglas puras de transferencia de stock entre ubicaciones (sin I/O).

/** Todo traspaso sale de bodega: el origen no lo elige el formulario. */
export const TRANSFER_ORIGIN = "storage" as const;

/** Fija el origen del traspaso a bodega, sea cual sea el origen que llegue. */
export function transferFromStorage<T extends { to_location: string }>(
  input: T
): T & { from_location: typeof TRANSFER_ORIGIN } {
  return { ...input, from_location: TRANSFER_ORIGIN };
}

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
