// Utilidades puras de formato y trazado para los graficos de reportes (sin React).

export function niceMaximum(value: number): number {
  const exponent = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return Math.ceil(value / exponent) * exponent;
}

export function smoothPath(points: Array<{ x: number; y: number }>): string {
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    if (!previous) throw new Error("Invariante de gráfico: punto previo ausente.");
    const control = (point.x - previous.x) * 0.4;
    return `${path} C ${previous.x + control} ${previous.y}, ${point.x - control} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}
