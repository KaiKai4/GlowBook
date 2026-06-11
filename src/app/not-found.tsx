import Link from "next/link";
import { connection } from "next/server";
import { GlowBookBrand } from "@/components/brand/glowbook-logo";

// connection(): el 404 global se renderiza por request para que el HTML
// lleve el nonce de la CSP (prerenderizado estatico quedaria sin nonce).
export default async function NotFound() {
  await connection();

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <GlowBookBrand markSize="sm" align="center" />
        </div>
        <p className="mt-6 text-5xl font-bold text-stone-300">404</p>
        <p className="mt-2 text-lg font-semibold text-stone-900">Página no encontrada</p>
        <p className="mt-1 text-sm text-stone-500">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
