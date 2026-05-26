# ADR 0001: Aislamiento Multi-Tenant Con RLS

## Estado

Aceptada.

## Contexto

GlowBook guarda datos sensibles de muchos salones: clientes, colaboradores, citas, roles, servicios, reportes y plantillas. Si el aislamiento dependiera solo de que cada query filtre manualmente por `salon_id`, un olvido podria exponer datos de otro salon.

## Decision

El aislamiento de tenant se garantiza en Supabase Postgres con Row Level Security. Las tablas de negocio deben tener RLS activada y politicas basadas en `public.salon_id()`.

El codigo de aplicacion tambien debe filtrar explicitamente por `salon_id` para claridad y rendimiento, pero la garantia de seguridad vive en la base de datos.

Las lecturas cross-tenant son excepciones de plataforma. Solo se hacen en servidor, despues de verificar superadmin, usando el cliente `service_role`.

## Consecuencias

Esto reduce el riesgo de fugas entre salones incluso si una pantalla o repositorio pide mas datos de los debidos.

Cada tabla nueva del dominio debe incluir `salon_id`, politicas RLS y pruebas/manual checks de acceso.

`service_role` se vuelve una llave maestra. Nunca debe exponerse en componentes cliente ni variables `NEXT_PUBLIC_*`.
