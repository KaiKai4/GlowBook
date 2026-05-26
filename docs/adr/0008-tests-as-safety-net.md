# ADR 0008: Tests Como Red De Seguridad Del Dominio

## Estado

Aceptada.

## Contexto

Las partes mas sensibles del sistema son reglas de negocio: disponibilidad, orden de servicios, ciclo de vida de citas, acceso de colaboradores, archivado/reactivacion y plantillas.

Si solo confiamos en pruebas manuales, una mejora pequena puede romper agenda, permisos o historial sin notarlo.

## Decision

El sistema debe tener tests unitarios sobre modulos profundos del dominio y use-cases criticos.

La primera red de seguridad usa Vitest para:

- disponibilidad y validacion de rangos horarios.
- construccion secuencial de items de cita.
- transiciones de estado y bloqueo de calendario.
- acceso, invitaciones y ciclo de vida de colaboradores.
- render de plantillas.

Las pruebas E2E quedan como siguiente capa para flujos completos de UI y aislamiento entre salones.

## Consecuencias

Los cambios en reglas criticas deben ir acompanados de tests.

Los tests deben cruzar la misma interfaz que usa la aplicacion, no detalles internos innecesarios.

Antes de commit o deploy se deben correr `npm run test`, `npm run type-check`, `npm run lint` y `npm run build`.
