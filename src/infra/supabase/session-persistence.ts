// Marcador de "no recordarme": cookie de sesion (sin Max-Age) que el login
// escribe cuando el usuario desmarca Recordarme. Mientras exista, toda
// escritura de cookies de auth se degrada a cookie de sesion, asi el
// navegador borra la sesion completa al cerrarse. La escribe el servidor
// (src/infra/auth/password-auth.ts); aquí solo vive el nombre compartido.
export const SESSION_ONLY_COOKIE = "gb-session-only";
