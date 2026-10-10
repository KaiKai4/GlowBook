// Interfaz pública del módulo de plataforma (super-admin). Solo servidor: no importar desde componentes cliente.
// Las rutas de `src/app/(platform)` que aún importan casos de uso directamente quedan pendientes de migrar.
export { getAdminHome } from "./use-cases/get-admin-home";
