import { NextResponse } from "next/server";

// Respuestas de las rutas de src/app/api/**. Toda respuesta lleva
// Cache-Control: no-store: ningun intermediario ni cache del navegador puede
// guardar datos de un salón ni errores de autorizacion.

const NO_STORE = "no-store";

export function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": NO_STORE } });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": NO_STORE } });
}

export function redirectNoStore(location: URL, status = 307): NextResponse {
  return NextResponse.redirect(location, { status, headers: { "Cache-Control": NO_STORE } });
}

export function binaryNoStore(body: ArrayBuffer, headers: Record<string, string>): NextResponse {
  return new NextResponse(body, { headers: { ...headers, "Cache-Control": NO_STORE } });
}
