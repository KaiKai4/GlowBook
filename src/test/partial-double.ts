/**
 * Doble parcial de `T` para pruebas: el test declara solo los campos que usa el
 * código bajo prueba y el resto no existe en el doble.
 *
 * Es el único punto de estrechamiento de los dobles de prueba (sustituye al
 * doble cast repartido por los tests). El compilador sigue comprobando
 * cada campo declarado porque el parámetro es `Partial<T>`.
 */
export function partialDouble<T>(fields: Partial<T>): T {
  return fields as T;
}
