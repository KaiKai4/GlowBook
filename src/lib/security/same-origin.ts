// Comprobacion de origen para acciones de estado que se disparan desde formularios
// (cierre de sesion). Un navegador envia Origin en los POST; si falta, se acepta
// solo Sec-Fetch-Site same-origin. Sin ninguna de las dos cabeceras se rechaza.
//
// El origen esperado sale del host por el que llego la peticion (Host o
// x-forwarded-host), no de request.url: en next start/dev la URL de la
// route handler se construye con "localhost" aunque el navegador use otro host.

function firstValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

/** Origen (esquema + host) por el que el cliente alcanzo la aplicacion. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = firstValue(request.headers.get("x-forwarded-host")) ?? firstValue(request.headers.get("host"));
  if (!host) return url.origin;
  const protocol = firstValue(request.headers.get("x-forwarded-proto")) ?? url.protocol.slice(0, -1);
  return `${protocol}://${host}`;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin !== null) return origin === requestOrigin(request);

  return request.headers.get("sec-fetch-site") === "same-origin";
}
