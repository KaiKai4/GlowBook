// Solo se aceptan comprobantes servidos por https. Impide enlaces javascript:,
// data: o http: en el enlace "Ver comprobante" y en el almacenamiento.
const HTTPS_PREFIX = /^https:\/\//i;

export function isHttpsReceiptUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && HTTPS_PREFIX.test(value);
}
