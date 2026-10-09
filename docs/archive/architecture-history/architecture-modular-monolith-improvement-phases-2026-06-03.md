# Fases Para Profundizar El Monolito Modular - 2026-06-03

## Objetivo

Convertir las mejoras propuestas en `docs/architecture-modular-monolith-assessment-2026-06-03.md` en fases ejecutables.

Estas fases buscan mejorar:

- Locality entre features.
- Depth de los Modules de lectura.
- Separacion de responsabilidades.
- Cumplimiento practico de SOLID.
- Guardrails contra acoplamiento accidental.
- Claridad de documentacion viva.

No buscan cambiar la arquitectura base. GlowBook debe mantenerse como monolito modular feature-first, siguiendo ADR 0009:

```text
src/app -> src/features/*/use-cases -> src/features/*/domain + src/features/*/data
```

## Principios De Ejecucion

- No mover carpetas por estetica.
- No crear abstracciones si no reducen acoplamiento real.
- No convertir cada repo en una Interface artificial.
- Crear Interfaces estrechas solo donde otro Module necesita una lectura estable.
- Mantener `domain/` libre de Next, React, Supabase y `server-only`.
- Mantener `src/app` fuera de `features/*/data`.
- Mantener `components/ui` libre de dominio.
- Mantener RLS como autoridad final de aislamiento multi-tenant.
- Cerrar cada fase con `npm run architecture:check`, `npm run type-check` y tests relevantes.

## Fase 0 - Baseline Y Criterio De Avance

Prioridad: inmediata.

Objetivo:

Dejar claro desde que estado parte la mejora y evitar cambiar Modules sin una razon arquitectonica concreta.

Trabajo:

- Tomar como diagnostico base `docs/architecture-modular-monolith-assessment-2026-06-03.md`.
- Confirmar que los guardrails actuales pasan.
- Identificar imports cross-feature hacia `data/` que se van a tocar en fases siguientes.
- Clasificar cada dependencia como:
  - dependencia aceptable por ahora,
  - candidata a read Module estrecho,
  - excepcion que requiere ADR o comentario documentado.

Comandos:

```text
npm run architecture:check
npm run type-check
```

Criterio de completado:

- Existe una lista corta de use-cases a refactorizar.
- No se inicia una migracion masiva de carpetas.
- El arbol de trabajo conserva solo cambios esperados.

Riesgo que reduce:

- Evita refactors por forma que no aumentan Depth ni Locality.

## Fase 1 - Read Modules Estrechos Para Clientes Y Vitrina

Prioridad: alta.

Objetivo:

Eliminar el acoplamiento directo de `retail` contra el Adapter de persistencia de `customers`.

Problema actual:

`src/features/retail/use-cases/retail-sales.ts` importa `findCustomers` desde `src/features/customers/data/customers.repo.ts`. Eso hace que Vitrina conozca la Implementation de persistencia de Clientes cuando solo necesita opciones simples para seleccionar un Cliente.

Trabajo:

- Crear un read Module estrecho en Clientes, por ejemplo:

```text
src/features/customers/use-cases/customer-options.ts
```

- Exponer una Interface minima:

```text
id
name
```

- Cambiar `retail/use-cases/retail-sales.ts` para consumir esa Interface.
- Agregar test del nuevo read Module.
- Ajustar tests de `retail-sales` para mockear la Interface nueva, no el Adapter de `customers/data`.

Archivos probables:

- `src/features/customers/use-cases/customer-options.ts`
- `src/features/customers/use-cases/customer-options.test.ts`
- `src/features/retail/use-cases/retail-sales.ts`
- `src/features/retail/use-cases/retail-sales.test.ts`

Criterio de completado:

- `retail` no importa `customers/data`.
- Vitrina recibe solo lo que necesita para selector de Clientes.
- Tests pasan.

Beneficio:

- Mejor Interface Segregation.
- Mejor Locality en Clientes.
- Menos query shape ajena dentro de Vitrina.

## Fase 2 - Read Modules Para Wizard De Citas

Prioridad: alta.

Objetivo:

Profundizar el Module de Citas para que el wizard consuma Interfaces estables de Clientes, Colaboradores, Salon y Catalogo Operativo.

Problema actual:

`src/features/appointments/use-cases/get-appointment-wizard-data.ts` importa Adapters de varias features:

- `customers/data`
- `employees/data`
- `salon/data`
- `services/data`

El wizard de Citas necesita cruzar dominios, pero hoy conoce demasiados detalles de Implementation de otros Modules.

Trabajo:

- Reutilizar `customers/use-cases/customer-options.ts` de Fase 1.
- Crear un read Module estrecho para Colaboradores disponibles para agenda, por ejemplo:

```text
src/features/employees/use-cases/employee-scheduling-options.ts
```

- Crear un read Module estrecho para Catalogo Operativo de agenda, por ejemplo:

```text
src/features/services/use-cases/service-scheduling-options.ts
```

- Crear un read Module estrecho para Configuracion de agenda del Salon, por ejemplo:

```text
src/features/salon/use-cases/salon-scheduling-config.ts
```

- Cambiar el wizard para depender de esas Interfaces, no de repos.
- Mantener las reglas de agenda en `appointments/domain`, no en los read Modules externos.

Archivos probables:

- `src/features/appointments/use-cases/get-appointment-wizard-data.ts`
- `src/features/appointments/use-cases/get-appointment-wizard-data.test.ts`
- `src/features/customers/use-cases/customer-options.ts`
- `src/features/employees/use-cases/employee-scheduling-options.ts`
- `src/features/services/use-cases/service-scheduling-options.ts`
- `src/features/salon/use-cases/salon-scheduling-config.ts`

Criterio de completado:

- `appointments/use-cases/get-appointment-wizard-data.ts` no importa `data/` de otras features.
- El wizard conserva el mismo view model.
- Las reglas del cursor secuencial, disponibilidad y validacion de asignaciones siguen viviendo en Citas.
- Tests de wizard pasan.

Beneficio:

- Citas gana Leverage: el caller ve una Interface de wizard, no una red de repos.
- Clientes, Colaboradores, Salon y Catalogo Operativo conservan Locality sobre sus lecturas.
- Cambios internos de una feature afectan menos al wizard.

## Fase 3 - Read Modules Para Recordatorios Operativos

Prioridad: media-alta.

Objetivo:

Reducir acoplamiento en Recordatorios sin mezclar su responsabilidad con Citas, Plantillas, Colaboradores o Salon.

Problema actual:

`src/features/reminders/use-cases/get-reminder-queue.ts` importa Adapters de:

- `appointments/data`
- `employees/data`
- `notifications/data`
- `salon/data`

Recordatorios debe orquestar el flujo operativo, pero no necesita conocer query shape de cada fuente.

Trabajo:

- Crear o reutilizar read Modules estrechos:
  - Citas recordables.
  - Nombres activos de Colaboradores.
  - Plantilla activa de recordatorio.
  - Identidad/zona horaria del Salon.
- Cambiar `get-reminder-queue.ts` para consumir esas Interfaces.
- Mantener `reminder-log.repo.ts` dentro de Recordatorios porque ese historial pertenece al Module.
- Agregar tests por Interface.

Archivos probables:

- `src/features/reminders/use-cases/get-reminder-queue.ts`
- `src/features/reminders/use-cases/get-reminder-queue.test.ts`
- `src/features/appointments/use-cases/remindable-appointments.ts`
- `src/features/employees/use-cases/employee-name-options.ts`
- `src/features/notifications/use-cases/active-message-template.ts`
- `src/features/salon/use-cases/salon-identity.ts`

Criterio de completado:

- Recordatorios ya no importa `data/` de features externas.
- La cola de recordatorios mantiene el mismo contrato.
- Plantillas siguen siendo propiedad de `notifications`.
- Logs siguen siendo propiedad de `reminders`.

Beneficio:

- Mejor Single Responsibility.
- Menos acoplamiento entre Recordatorios y detalles de Citas.
- Mejor test surface: la Interface del flujo se puede probar sin detalles de cada repo.

## Fase 4 - Read Modules Para Empleados Y Roles

Prioridad: media.

Objetivo:

Separar mejor la pagina de Colaboradores de los detalles de Roles y Catalogo Operativo.

Problema actual:

`src/features/employees/use-cases/get-employees-page.ts` importa:

- `access/data/roles.repo.ts`
- `services/data/services.repo.ts`

Eso hace que Colaboradores conozca query shape de Roles y Catalogo Operativo para construir su pagina.

Trabajo:

- Crear un read Module estrecho en Access:

```text
src/features/access/use-cases/role-options.ts
```

- Crear o reutilizar un read Module estrecho en Services:

```text
src/features/services/use-cases/category-service-options.ts
```

- Cambiar `get-employees-page.ts` y `get-employee-detail.ts` para consumir esas Interfaces.
- Mantener las reglas de asignacion de colaborador en `employees/domain`.

Archivos probables:

- `src/features/employees/use-cases/get-employees-page.ts`
- `src/features/employees/use-cases/get-employees-page.test.ts`
- `src/features/employees/use-cases/get-employee-detail.ts`
- `src/features/employees/use-cases/get-employee-detail.test.ts`
- `src/features/access/use-cases/role-options.ts`
- `src/features/services/use-cases/category-service-options.ts`

Criterio de completado:

- `employees` no importa `access/data` ni `services/data` para opciones de pagina.
- Roles del sistema siguen filtrandose en la Interface propietaria o en una regla explicitamente probada.
- Tests de empleados pasan.

Beneficio:

- Menor acoplamiento entre Colaboradores, Roles y Catalogo Operativo.
- Mejor Open/Closed cuando cambien permisos o categorias.

## Fase 5 - Guardrail Suave Para Imports Cross-Feature

Prioridad: media.

Objetivo:

Hacer visible el acoplamiento nuevo antes de que crezca, sin bloquear el desarrollo normal.

Problema actual:

`scripts/check-architecture.mjs` detecta violaciones fuertes, pero no advierte cuando una feature importa `data/` de otra feature.

Trabajo:

- Agregar warnings para imports de esta forma:

```text
src/features/A/use-cases/* -> src/features/B/data/*
```

- No fallar el comando al inicio. Solo reportar warnings.
- Permitir excepciones documentadas con una lista pequena si alguna dependencia queda justificada.
- Actualizar ADR 0009 o agregar nota en docs si se define la regla como convencion.

Archivos probables:

- `scripts/check-architecture.mjs`
- `docs/adr/0009-modular-monolith-feature-architecture.md`
- tests o fixtures del script si se agregan.

Criterio de completado:

- `npm run architecture:check` sigue pasando.
- El script muestra warnings utiles para cross-feature `data/`.
- Los warnings no incluyen imports dentro de la misma feature.
- Las excepciones quedan nombradas y revisables.

Beneficio:

- Reduce deuda tecnica futura.
- Hace visible la perdida de Locality.
- Empuja a crear Interfaces estrechas solo cuando hay presion real.

## Fase 6 - Actualizar `architecture-health.mjs`

Prioridad: media.

Objetivo:

Alinear el reporte de salud arquitectonica con la documentacion vigente.

Problema actual:

`scripts/architecture-health.mjs` aun espera documentos historicos en rutas antiguas. Eso puede producir falsos `MISSING` aunque la documentacion actual este bien.

Trabajo:

- Actualizar la lista de documentos esperados para usar:
  - `docs/architecture-audit-current-state-2026-06-03.md`
  - `docs/architecture-improvement-phases-2026-06-03.md`
  - `docs/architecture-modular-monolith-assessment-2026-06-03.md`
  - este documento de fases
  - `docs/archive/architecture-history/README.md`
  - ADRs principales
  - runbooks vigentes
- Revisar si `architecture-health` debe seguir ejecutando E2E o solo reportar su estado.
- Evitar que este script falle por ausencia de secretos locales.

Archivos probables:

- `scripts/architecture-health.mjs`
- `docs/README.md`

Criterio de completado:

- `npm run architecture:health` reporta documentos vigentes.
- No marca como faltantes documentos correctamente archivados.
- El reporte diferencia fallos reales de checks opcionales.

Beneficio:

- Mejor confianza en la documentacion viva.
- Menos ruido al revisar arquitectura.

## Fase 7 - Dividir `services-manager.tsx`

Prioridad: media-baja.

Objetivo:

Reducir complejidad visual en Catalogo Operativo sin mover reglas de negocio a UI compartida.

Problema actual:

`src/app/(dashboard)/services/services-manager.tsx` sigue siendo uno de los archivos mas grandes de `src/app`. No viola la arquitectura, pero concentra demasiado estado y UI local.

Trabajo:

- Mantener `services-manager.tsx` como coordinador.
- Extraer Modules route-local:
  - `ServicesStats`
  - `ServicesTabs`
  - `CategoryForm`
  - `ServiceForm`
  - `ServicesList`
  - `CategoryList`
- No mover estos Modules a `components/ui`, porque contienen dominio del Catalogo Operativo.
- Mantener Server Actions y use-cases existentes.

Archivos probables:

- `src/app/(dashboard)/services/services-manager.tsx`
- `src/app/(dashboard)/services/services-stats.tsx`
- `src/app/(dashboard)/services/services-tabs.tsx`
- `src/app/(dashboard)/services/category-form.tsx`
- `src/app/(dashboard)/services/service-form.tsx`
- `src/app/(dashboard)/services/services-list.tsx`
- `src/app/(dashboard)/services/category-list.tsx`

Criterio de completado:

- `services-manager.tsx` queda como coordinador legible.
- Formularios y listados tienen responsabilidad unica.
- No cambia el contrato de `features/services`.
- Type-check y pruebas relevantes pasan.

Beneficio:

- Mejor Single Responsibility en UI.
- Menor riesgo al tocar Catalogo Operativo.
- Mas facil revisar cambios visuales.

## Fase 8 - Profundizar `finance` Si El Read Model Crece

Prioridad: baja, condicional.

Objetivo:

Mantener `finance` como Interface de resumen financiero operativo sin convertirlo en un lector directo de todas las tablas del sistema.

Problema actual:

`src/features/finance/use-cases/operational-money.ts` importa repos concretos de Gastos, Inventario y Vitrina. Hoy esto es aceptable porque `finance` existe para integrar dinero operativo, pero puede crecer demasiado.

Trabajo condicional:

- Solo ejecutar si se agregan nuevas fuentes de ingreso o egreso.
- Crear read Modules propietarios:
  - `retail/use-cases/retail-revenue.ts`
  - `expenses/use-cases/manual-expense-total.ts`
  - `inventory/use-cases/inventory-purchase-total.ts`
- Mantener `finance` como coordinador de totales, no como dueno de cada fuente.
- No duplicar formulas.

Archivos probables:

- `src/features/finance/use-cases/operational-money.ts`
- `src/features/finance/use-cases/operational-money.test.ts`
- `src/features/retail/use-cases/retail-revenue.ts`
- `src/features/expenses/use-cases/manual-expense-total.ts`
- `src/features/inventory/use-cases/inventory-purchase-total.ts`

Criterio de completado:

- Dashboard y Reportes siguen consumiendo `finance`.
- Cada fuente conserva Locality en su Module propietario.
- `finance` calcula totales desde Interfaces estrechas.

Beneficio:

- Mejor Depth del resumen financiero operativo.
- Menos acoplamiento si el sistema agrega pagos, comisiones o nuevas fuentes.

## Orden Recomendado

1. Fase 0 - Baseline.
2. Fase 1 - Clientes y Vitrina.
3. Fase 2 - Wizard de Citas.
4. Fase 3 - Recordatorios Operativos.
5. Fase 4 - Empleados y Roles.
6. Fase 5 - Guardrail cross-feature.
7. Fase 6 - `architecture-health`.
8. Fase 7 - `services-manager`.
9. Fase 8 - `finance`, solo si crece el read model.

## Avance Actual

### Fase 0 - Completada

Estado: completada.

Evidencia:

- Se identificaron imports cross-feature hacia `data/`.
- `npm run architecture:check` pasa.
- El guardrail ahora reporta warnings cuando aparece acoplamiento nuevo.

### Fase 1 - Implementada

Estado: implementada.

Cambios realizados:

- Se creo `src/features/customers/use-cases/customer-options.ts`.
- Vitrina dejo de importar `customers/data`.
- `retail-sales` consume la Interface estrecha de Clientes.
- Se agregaron tests para la Interface de opciones de Clientes.

### Fase 2 - Implementada

Estado: implementada.

Cambios realizados:

- Se crearon read Modules estrechos para:
  - Clientes activos.
  - Colaboradores disponibles para agenda.
  - Catalogo Operativo para agenda.
  - Configuracion/horarios de agenda del Salon.
- `get-appointment-wizard-data.ts` dejo de importar `data/` de features externas.
- El wizard conserva su view model y filtra elegibilidad de Colaboradores por servicios activos.

### Fase 3 - Implementada

Estado: implementada.

Cambios realizados:

- Se crearon read Modules estrechos para:
  - Citas recordables.
  - Nombres activos de Colaboradores.
  - Plantilla activa de mensaje.
  - Identidad del Salon.
- `get-reminder-queue.ts` dejo de importar `data/` de Citas, Colaboradores, Plantillas y Salon.
- `record-manual-reminder.ts` consume una Interface estrecha de Citas para validar el target del recordatorio.

### Fase 4 - Implementada

Estado: implementada.

Cambios realizados:

- Se creo `src/features/access/use-cases/role-options.ts`.
- Se creo `src/features/services/use-cases/category-service-options.ts`.
- `employees` dejo de importar `access/data` y `services/data` para opciones de pagina y detalle.

### Fase 5 - Implementada

Estado: implementada.

Cambios realizados:

- `scripts/check-architecture.mjs` ahora agrega warnings para imports cross-feature hacia `data/`.
- Los warnings no fallan el build; sirven como radar de deuda nueva.
- Despues de los refactors, `npm run architecture:check` pasa sin warnings.

### Fase 6 - Implementada

Estado: implementada.

Cambios realizados:

- `scripts/architecture-health.mjs` fue actualizado para revisar documentos vigentes.
- El script ya no espera auditorias historicas en rutas antiguas.

### Fase 7 - Implementada

Estado: implementada.

Cambios realizados:

- `services-manager.tsx` quedo como coordinador de estado, filtros, dialogos y acciones.
- Se extrajeron Modules route-local para:
  - estadisticas,
  - sidebar de categorias,
  - filtros,
  - seccion de categoria,
  - tarjeta de servicio,
  - estado vacio,
  - dialogo de categoria,
  - dialogo de nuevo servicio,
  - dialogo de edicion de servicio.
- Las reglas de Catalogo Operativo siguen viviendo en `features/services`.
- Los Modules extraidos permanecen en `src/app/(dashboard)/services` porque contienen UI de dominio de esa ruta.

### Fase 8 - Implementada Para Las Fuentes Actuales

Estado: implementada para las fuentes actuales.

Cambios realizados:

- Se crearon read Modules propietarios para fuentes de dinero:
  - `retail/use-cases/retail-revenue.ts`
  - `expenses/use-cases/manual-expense-total.ts`
  - `inventory/use-cases/inventory-purchase-total.ts`
- `finance` calcula el resumen financiero operativo desde esas Interfaces estrechas.

Nota:

- Si aparecen nuevas fuentes de dinero, mantener este patron: la fuente conserva su lectura en el Module propietario y `finance` coordina totales.

## Validacion Por Fase

Cada fase debe cerrar con:

```text
npm run architecture:check
npm run type-check
npm run test -- <tests relevantes si aplica>
```

Antes de merge o deploy:

```text
npm run ci:verify
```

Si la fase toca migraciones, RLS, RPCs o contratos de base:

```text
npm run staging:migrations
npm run release:migrations
```

## Resultado Esperado

Al cerrar estas fases, GlowBook deberia tener:

- Menos imports cross-feature hacia `data/`.
- Use-cases de pagina mas profundos y menos acoplados.
- Interfaces de lectura pequenas en los Modules propietarios.
- Guardrails que avisan cuando aparece deuda nueva.
- Documentacion viva alineada con los scripts.
- UI de Catalogo Operativo mas mantenible.
- `finance` listo para crecer sin convertirse en carpeta comodin.

## Regla Practica

Aplicar esta regla antes de cada refactor:

```text
Si otro Module solo necesita una lista, selector, total o resumen,
el Module propietario debe exponer una Interface estrecha.
```

Aplicar el deletion test:

```text
Si borrar el Module solo mueve la misma complejidad a varios callers,
ese Module estaba ganando su lugar.

Si borrar el Module elimina complejidad sin que reaparezca,
probablemente era un pass-through shallow.
```
