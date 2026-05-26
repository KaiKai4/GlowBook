# ADR 0003: RBAC Dinamico Basado En Permisos

## Estado

Aceptada.

## Contexto

Cada salon puede necesitar roles distintos. Hardcodear nombres como owner, recepcionista o colaborador vuelve rigido el producto y obliga a redesplegar para cambiar permisos.

## Decision

Los permisos son un catalogo global que el sistema sabe aplicar. Los roles pertenecen a cada salon y agrupan permisos.

La autorizacion pregunta por permisos, por ejemplo `appointments.manage`, `roles.manage` o `customers.manage`. No debe depender del nombre visible del rol.

`is_owner = true` actua como cortocircuito para que el owner conserve acceso total al salon.

## Consecuencias

El owner puede adaptar roles a su operacion sin cambios de codigo.

El catalogo de permisos debe mantenerse sincronizado entre migraciones y `src/features/access/domain/permissions.ts`.

Las Server Actions y repositorios deben evitar logica como "si el rol se llama X".
