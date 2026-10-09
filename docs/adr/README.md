# Architecture Decision Records

Los ADR registran decisiones importantes del sistema. Sirven para que futuras auditorias, refactors y nuevas funciones no vuelvan a discutir decisiones que ya tienen una razon clara.

Formato usado:

- **Estado**: si la decision esta aceptada, propuesta o reemplazada.
- **Contexto**: que problema existia.
- **Decision**: que vamos a hacer.
- **Consecuencias**: beneficios, costos y cuidados.

Para entender el vocabulario del dominio, leer primero `CONTEXT.md`.

## Indice

- [ADR 0001](0001-multi-tenant-rls.md): Aislamiento Multi-Tenant Con RLS.
- [ADR 0002](0002-appointment-items-source-of-truth.md): Appointment Items Como Fuente De Verdad.
- [ADR 0003](0003-dynamic-rbac-permissions.md): RBAC Dinamico Basado En Permisos.
- [ADR 0004](0004-archive-reactivate-customers-collaborators.md): Archivar Y Reactivar Clientes O Colaboradores.
- [ADR 0005](0005-closed-onboarding-platform-invitations.md): Onboarding Cerrado Por Invitaciones De Plataforma.
- [ADR 0006](0006-delete-salon-through-transactional-rpc.md): Eliminacion Completa De Salon Por RPC Transaccional.
- [ADR 0007](0007-notification-templates-operational-messages.md): Plantillas Para Mensajes Operativos.
- [ADR 0008](0008-tests-as-safety-net.md): Tests Como Red De Seguridad Del Dominio.
- [ADR 0009](0009-modular-monolith-feature-architecture.md): Modular Monolith Feature Architecture.
- [ADR 0010](0010-server-only-admin-adapter-exceptions.md): Server-Only Admin Adapter Exceptions.
- [ADR 0011](0011-verificador-local-igual-ci.md): Verificador Local Igual Que CI.
- [ADR 0012](0012-toolchain-de-calidad.md): Toolchain De Calidad.
- [ADR 0013](0013-trinquetes-de-deuda.md): Trinquetes De Deuda Tecnica.
- [ADR 0014](0014-bd-de-pruebas-supabase-local.md): Base De Datos De Pruebas Con Supabase Local.
- [ADR 0015](0015-politica-excepciones-auditoria.md): Politica De Excepciones De Auditoria De Dependencias.
- [ADR 0016](0016-migraciones-forward-only-expand-contract.md): Migraciones Forward-Only Con Expand/Contract.
