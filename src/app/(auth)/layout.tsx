// Estas paginas son shells de Server Component que renderizan formularios Client.
// Next las prerenderizaria estaticas, pero la CSP con nonce exige render dinamico:
// el HTML prerenderizado no lleva nonce y el navegador bloquearia los scripts de la pagina.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
