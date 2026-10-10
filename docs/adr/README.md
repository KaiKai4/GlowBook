# Architecture Decision Records

Los ADR registran decisiones importantes del sistema. Sirven para que futuras auditorías, refactors y funciones no vuelvan a discutir decisiones que ya tienen una razón clara.

## Cuándo Escribir Un ADR

Escribe un ADR cuando el cambio:

- fija un contrato de datos, de RLS, de RPC o de permisos;
- añade o cambia una capa, una dependencia o una herramienta de calidad;
- crea una excepción de seguridad, de auditoría o de tamaño de módulo;
- toma una decisión que alguien podría revertir sin entender el motivo.

Si la decisión es obvia o se deduce del código, no hace falta ADR.

## Formato

- **Estado**: `Aceptada`, `Propuesta` o `Superada por ADR NNNN`. Un ADR superado no se borra: se marca y se enlaza al que lo sustituye. Si solo una parte queda superada, el estado es `Aceptada, con partes superadas por ADR NNNN` y la sección afectada lo dice.
- **Contexto**: qué problema existía.
- **Decisión**: qué se hace.
- **Consecuencias**: beneficios, costes y cuidados.

Para el vocabulario del dominio, leer antes `CONTEXT.md`.

## Índice

Estado revisado a 2026-10-10: los 28 ADR están vigentes (ADR 0025 sustituida por ADR 0028), con las sustituciones parciales indicadas en cada estado. El ADR 0024 revisa la parte de billing del ADR 0010: las lecturas de billing del propio salón van por RLS y ya no por `service_role`. Ninguno está superado por completo. Los ADR 0009, 0010 y 0013 tienen partes superadas por el ADR 0019 (su estado lo indica): las partes vigentes siguen siendo válidas. ADR 0012 y ADR 0020 tienen las partes de Nightly y staging remoto sustituidas por ADR 0021. ADR 0012 queda además parcialmente superada por ADR 0022 (Stryker y scripts de readiness retirados).

| ADR | Título | Ámbito |
|---|---|---|
| [0001](0001-multi-tenant-rls.md) | Aislamiento multi-tenant con RLS | Datos y seguridad |
| [0002](0002-appointment-items-source-of-truth.md) | Appointment items como fuente de verdad | Citas |
| [0003](0003-dynamic-rbac-permissions.md) | RBAC dinámico basado en permisos | Acceso |
| [0004](0004-archive-reactivate-customers-collaborators.md) | Archivar y reactivar clientes o colaboradores | Dominio |
| [0005](0005-closed-onboarding-platform-invitations.md) | Onboarding cerrado por invitaciones de plataforma | Plataforma |
| [0006](0006-delete-salon-through-transactional-rpc.md) | Eliminación completa de salón por RPC transaccional | Plataforma y datos |
| [0007](0007-notification-templates-operational-messages.md) | Plantillas para mensajes operativos | Notificaciones |
| [0008](0008-tests-as-safety-net.md) | Tests como red de seguridad del dominio | Pruebas |
| [0009](0009-modular-monolith-feature-architecture.md) | Modular monolith feature architecture | Arquitectura |
| [0010](0010-server-only-admin-adapter-exceptions.md) | Excepciones server-only del adaptador admin (parte de billing acotada por ADR 0024) | Seguridad y arquitectura |
| [0011](0011-verificador-local-igual-ci.md) | Verificador local igual que CI | Calidad |
| [0012](0012-toolchain-de-calidad.md) | Toolchain de calidad (parcialmente superada por ADR 0022) | Calidad |
| [0013](0013-trinquetes-de-deuda.md) | Trinquetes de deuda técnica | Calidad |
| [0014](0014-bd-de-pruebas-supabase-local.md) | Base de datos de pruebas con Supabase local | Calidad y datos |
| [0015](0015-politica-excepciones-auditoria.md) | Política de excepciones de auditoría de dependencias | Seguridad y calidad |
| [0016](0016-migraciones-forward-only-expand-contract.md) | Migraciones forward-only con expand/contract | Datos |
| [0017](0017-rate-limit-compartido-postgres.md) | Rate limit compartido en Postgres | Seguridad |
| [0018](0018-errores-publicos-tipados.md) | Errores públicos tipados | Errores y seguridad |
| [0019](0019-arquitectura-por-capas-verificada.md) | Arquitectura por capas verificada por herramienta | Arquitectura y calidad |
| [0020](0020-release-validada-en-staging.md) | Release validada en staging y publicación explícita | Deploy y seguridad |
| [0021](0021-deploy-sin-staging-remoto.md) | Deploy sin staging remoto obligatorio | Deploy y operación |
| [0022](0022-retiro-tooling-staging-pricing-readiness-stryker.md) | Retiro de tooling de staging, pricing, readiness y Stryker | Calidad y operación |
| [0023](0023-rpc-transaccionales-roles-invitacion-cita.md) | RPC transaccionales para roles, invitación con plan y cita con cliente nuevo | Datos, citas y plataforma |
| [0024](0024-lecturas-de-billing-de-inquilino-con-rls.md) | Lecturas de billing del inquilino con RLS y escrituras de plataforma acotadas (revisa parte de ADR 0010) | Datos, billing y seguridad |
| [0025](0025-cuando-inyectar-dependencias.md) | Cuándo inyectar dependencias (DIP pragmático) (sustituida por ADR 0028) | Arquitectura y pruebas |
| [0028](0028-inyeccion-en-comandos-con-logica.md) | Inyección de dependencias en comandos con lógica (sustituye a ADR 0025; modifica reglas de capas de ADR 0019) | Arquitectura y pruebas |
| [0026](0026-runner-pgtap-propio-y-supabase-local-sin-analytics.md) | Runner pgTAP propio y Supabase local sin analytics | Calidad y datos |
| [0027](0027-rate-limit-de-inicio-de-sesion.md) | Rate limit de inicio de sesión (global por IP y por IP con correo) | Seguridad |

Las guías que aplican estas decisiones son `docs/testing.md`, `docs/database-contracts.md` y `docs/security.md`.
