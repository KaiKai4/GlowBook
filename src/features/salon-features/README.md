# Salon Features Module

Responsabilidad: catálogo fijo de módulos contratables del salón (citas, recordatorios, clientes, colaboradores, servicios, inventario, etc.) y los permisos que cada uno afecta.

Interface principal (`index.ts`): módulo puro (sin I/O) que reexporta `domain/salon-features.ts`. Lo usan `access`, `billing`, `salon`, `platform` y la navegación.

Dominio (`domain/salon-features.ts`):

- `SALON_FEATURES`: lista única de módulos. Cada uno tiene `key`, `label`, `description` y `permissions`.
- El mapa permiso -> módulo de `access` se deriva de aquí.

Reglas importantes:

- Este módulo no importa `access`, para evitar ciclos: los permisos son cadenas.
- Añadir un módulo contratable implica tocar este catálogo y, si aplica, la migración de permisos.
- No tiene tablas ni casos de uso propios.

Tests: este módulo no tiene pruebas propias; su comportamiento se prueba en `src/features/access/domain/permission-features.test.ts` y en `src/features/billing`.
