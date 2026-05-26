# ADR 0004: Archivar Y Reactivar Clientes O Colaboradores

## Estado

Aceptada.

## Contexto

Clientes y colaboradores pueden tener citas historicas, pagos, recordatorios o reportes asociados. Borrarlos fisicamente desde el salon rompe trazabilidad y puede dejar historial incompleto.

Tambien puede ocurrir que un cliente o colaborador regrese despues de haber sido eliminado visualmente.

## Decision

En clientes y colaboradores, eliminar desde el salon significa archivar: `is_active = false`.

Un registro archivado conserva su historial, pero no aparece en flujos activos como nueva cita, selectores de clientes, selectores de profesionales o recordatorios operativos.

Si la persona regresa, se reactiva el registro existente con `is_active = true` para evitar duplicados y conservar trazabilidad.

En colaboradores, el acceso al sistema no se restaura automaticamente. Si necesita volver a entrar, se genera una nueva invitacion.

## Consecuencias

El historial queda confiable y no se pierden relaciones de citas.

Las pantallas deben ofrecer filtros de activos y archivados.

La creacion debe detectar coincidencias claras con archivados, especialmente por telefono o email, y sugerir reactivar en lugar de duplicar.

La eliminacion completa solo existe a nivel superadmin para borrar un salon entero.
