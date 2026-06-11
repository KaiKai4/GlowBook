// Marcador de "no recordarme": cookie de sesion (sin Max-Age) que el login
// escribe cuando el usuario desmarca Recordarme. Mientras exista, toda
// escritura de cookies de auth se degrada a cookie de sesion, asi el
// navegador borra la sesion completa al cerrarse.
export const SESSION_ONLY_COOKIE = "gb-session-only";

/** Marca o limpia el modo "solo esta sesion" antes de iniciar sesion. */
export function rememberSessionInBrowser(remember: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = remember
    ? `${SESSION_ONLY_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`
    : `${SESSION_ONLY_COOKIE}=1; path=/; SameSite=Lax`;
}
