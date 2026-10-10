// Redondeo monetario único: dos decimales, con corrección de error de coma flotante.
export function roundCurrency(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(amount);
}

// Número abreviado para ejes y etiquetas de gráficos ("1,2 mil"); los valores menores de 1000 no se abrevian.
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("es-PA", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

// Convierte un importe leído de la BD (numeric llega como string) o ausente en número.
// Equivale a Number(value ?? 0).
export function toAmount(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}
