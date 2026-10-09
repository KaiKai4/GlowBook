# Auditoria De Arquitectura Actual - 2026-06-03

## Objetivo

Evaluar la arquitectura actual de GlowBook usando la skill `improve-codebase-architecture`, con foco en organizacion de carpetas, monolito modular, deuda tecnica, separacion de responsabilidades, principios SOLID, seguridad multi-tenant y preparacion para operar con salones reales.

Esta auditoria revisa el estado actual del proyecto despues de las ultimas mejoras de citas, recordatorios, precios variables, inventario, vitrina y gastos.

## Metodo

Se revisaron:

- `CONTEXT.md`, para validar el lenguaje del dominio.
- `docs/adr/0001-multi-tenant-rls.md`, para revisar la decision de RLS multi-tenant.
- `docs/adr/0009-modular-monolith-feature-architecture.md`, para comparar contra la arquitectura esperada.
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`, para revisar excepciones de `service_role`.
- `src/app`, `src/features`, `src/components`, `src/lib`, `src/test` y `supabase/migrations`.
- Los modulos nuevos de `inventory`, `retail` y `expenses`.
- Las rutas principales del dashboard.

Tambien se ejecutaron verificaciones tecnicas:

- `npm.cmd run lint`: correcto.
- `npm.cmd run type-check`: correcto.
- `npm.cmd run test`: 55 archivos y 157 pruebas correctas.

## Resumen Ejecutivo

GlowBook esta usando una arquitectura de monolito modular basada en features. La direccion general es buena: `src/app` funciona como capa de entrega, `src/features` contiene la logica de negocio, `src/lib` concentra infraestructura compartida y `supabase/migrations` es la fuente de verdad de base de datos.

El proyecto esta suficientemente ordenado para continuar mejorando funciones del sistema y operar con un numero inicial pequeno de salones. Para 5 a 10 salones, la arquitectura actual es razonable si se mantiene disciplina con migraciones, pruebas y despliegues.

Para crecer mas alla de ese punto, el riesgo principal ya no es la estructura de carpetas, sino la consistencia transaccional de flujos de dinero e inventario. Venta de vitrina, compra de inventario y movimientos de stock deben quedar como operaciones atomicas, porque hoy la logica esta separada en pasos que pueden quedar a medias si Supabase falla entre una escritura y otra.

Calificacion actual:

- Modularidad general: 8/10.
- Separacion de responsabilidades: 7.5/10.
- Preparacion para 10 salones: 8/10.
- Preparacion para escala nacional: 6.5/10.
- Riesgo de deuda tecnica inmediata: medio.

## Arquitectura Actual

La arquitectura real se parece a este modelo:

```text
src/app
  Interface de Next.js: rutas, layouts, Server Actions y UI de pagina.

src/features
  Modules de negocio: domain, data, schemas, use-cases y tipos por feature.

src/components
  UI compartida y layout estable.

src/lib
  Adapters compartidos: Supabase, auth, sesiones, utilidades y resultados.

supabase/migrations
  Contratos de base de datos, RLS, permisos, tablas y funciones SQL.

docs/adr
  Decisiones arquitectonicas aceptadas.
```

Este diseno cumple con la ADR 0009: `app -> use-cases -> domain/data`. La direccion es correcta porque evita que las pantallas de Next.js se conviertan en el lugar donde vive toda la regla de negocio.

## Auditoria Por Carpetas

### Raiz Del Proyecto

La raiz esta bien orientada: configuracion de Next.js, ESLint, Vitest, Supabase y scripts estan separados. Hay buena senal de madurez porque existe `scripts/check-architecture.mjs`, lo que permite controlar reglas de arquitectura automaticamente.

Riesgo: el despliegue reciente mostro que se puede subir codigo a produccion antes de aplicar migraciones. Eso no es un problema de carpetas, pero si es un problema de proceso arquitectonico. El sistema debe tener un gate de release para evitar que Vercel ejecute codigo nuevo contra una base de datos vieja.

Recomendacion: crear un chequeo obligatorio de migraciones pendientes antes de push/deploy de produccion.

### `docs`

La carpeta `docs` contiene auditorias, fases, runbooks, ADRs y revisiones historicas. Esto ayuda a entender el proyecto, pero ya hay bastante documento viejo.

Estado: aceptable.

Riesgo: documentos antiguos pueden confundir si no se distingue que es historico y que es la fuente actual.

Recomendacion: mantener como documentos vivos solo:

- ADRs.
- Runbooks.
- Auditoria actual.
- Roadmap actual.

Las auditorias antiguas pueden conservarse como historial, pero no deberian usarse como guia operativa principal.

### `docs/adr`

Muy buen punto del proyecto. Las ADRs explican decisiones importantes:

- Multi-tenant con RLS.
- Monolito modular por features.
- Excepciones controladas para `service_role`.

Estado: fuerte.

Recomendacion: si se acepta crear un modulo de finanzas/egresos operativos como contrato formal, se debe documentar en una ADR o actualizar `CONTEXT.md`.

### `supabase/migrations`

La carpeta de migraciones esta cumpliendo su funcion como fuente de verdad del contrato de base de datos. Las tablas recientes de inventario, vitrina y gastos estan en el lugar correcto.

Estado: bueno.

Riesgo alto: produccion puede quedar desincronizada si las migraciones no se aplican antes o junto con el deploy.

Recomendacion prioritaria: agregar un proceso de release con estos pasos:

1. Verificar migraciones pendientes.
2. Aplicar migraciones al proyecto correcto.
3. Ejecutar `lint`, `type-check` y tests.
4. Hacer deploy/push.
5. Revisar rutas criticas.

### `src/app`

`src/app` esta funcionando como Interface de entrega: rutas, pantallas, Server Actions y formularios. Eso es correcto para Next.js.

Estado: bueno, pero con archivos grandes.

Archivos que siguen siendo profundos o pesados:

- `src/app/(dashboard)/inventory/inventory-manager.tsx`
- `src/app/(dashboard)/expenses/expenses-manager.tsx`
- `src/app/(dashboard)/retail/retail-manager.tsx`
- `src/app/(dashboard)/services/services-manager.tsx`
- `src/app/(dashboard)/recordatorios/reminders-view.tsx`

Problema: algunos managers de pagina concentran demasiados flujos de UI. Esto no rompe la arquitectura, pero reduce Locality: para cambiar una parte pequena hay que leer demasiado codigo.

Recomendacion: dividir cada manager grande en componentes o hooks locales por flujo:

- resumen,
- filtros,
- formulario,
- historial,
- tarjeta/listado,
- acciones.

### `src/features`

Esta es la parte mas importante del monolito modular. En general esta bien implementada: cada Module tiene su propio dominio, use-cases y data Adapters.

Estado general: bueno.

El patron dominante es:

```text
features/<module>
  domain
  data
  schemas.ts
  types.ts
  use-cases
```

Esto da buena separacion entre Interface, Implementation y Adapter.

### `src/features/appointments`

Es el modulo mas grande y central. Contiene reglas de agenda, items, completar citas, precios y actualizaciones.

Estado: fuerte.

Lo positivo:

- `appointment_items` sigue siendo fuente de verdad de servicios realizados.
- La regla de precio variable al completar esta mejor ubicada que si viviera solo en UI.
- Hay tests relevantes.

Riesgo: por ser el modulo central, cualquier cambio debe mantenerse con use-cases claros y pruebas.

### `src/features/inventory`

El modulo de inventario esta bien separado como Module: productos, stock por ubicacion, movimientos, compras tecnicas y reglas de stock.

Estado: bueno, con riesgo transaccional.

Lo positivo:

- Un producto existe una vez.
- El stock se separa por ubicacion: vitrina, uso interno y bodega.
- Los movimientos se registran como historial.
- Se diferencia producto vendible vs solo inventario/trabajo.

Riesgo importante:

`adjustInventoryStock` actualiza stock y luego crea movimiento como pasos separados. Si falla uno de los pasos, el inventario puede quedar inconsistente.

Recomendacion fuerte: mover las mutaciones de stock a una operacion atomica, idealmente una funcion SQL/RPC como:

- `apply_inventory_movement`
- `record_inventory_purchase`
- `record_retail_sale`

Esa funcion debe actualizar stock y registrar movimiento dentro de la misma transaccion.

### `src/features/retail`

Vitrina esta separada como modulo propio. Eso es correcto porque vender productos no es lo mismo que agendar citas ni registrar gastos.

Estado: bueno para v1.

Lo positivo:

- La venta descuenta stock.
- Cliente es opcional.
- El origen se sugiere desde vitrina.
- La UI ya fue corregida para cantidades enteras.

Riesgo:

La venta descuenta stock y luego registra venta/items como pasos separados. Esto debe convertirse en una transaccion.

Recomendacion fuerte: crear un use-case/RPC atomico para venta de vitrina.

### `src/features/expenses`

Gastos evoluciono correctamente hacia centro de egresos. Esta decision es buena: una compra de inventario tambien es salida de dinero y debe verse en historial de gastos.

Estado: bueno, pero necesita consolidar el Seam con inventario.

Lo positivo:

- Gasto general y compra de inventario conviven en el historial.
- `Comercio / empresa` es mejor lenguaje que `Proveedor / destino`.
- El concepto libre evita encerrar al salon en categorias insuficientes.

Riesgo:

El modulo de gastos depende de compras de inventario para armar historial. Esto esta bien como producto, pero arquitectonicamente conviene nombrar ese contrato como un read model de egresos, no como dependencias sueltas.

Recomendacion: crear una Interface de lectura de egresos operativos que una:

- gastos manuales,
- compras de inventario,
- filtros,
- totales.

### `src/features/reports`

Reportes ya esta separado, pero depende de varias fuentes: citas, vitrina, gastos y compras de inventario.

Estado: funcional.

Riesgo: reportes conoce demasiado de cada fuente de dinero. Esto es normal al crecer, pero si se deja asi puede convertirse en una zona de acoplamiento.

Recomendacion: crear un Module de lectura financiera/operativa que entregue ingresos, egresos y utilidad estimada a reportes y dashboard.

### `src/features/dashboard`

Dashboard funciona como resumen operativo. El problema es parecido al de reportes: necesita leer muchas fuentes.

Estado: funcional.

Recomendacion: que dashboard consuma un read model consolidado para dinero, stock bajo y metricas operativas, en vez de consultar cada modulo directamente.

### `src/features/customers`

Modulo limpio y razonablemente pequeno. La separacion de clientes esta bien.

Estado: bueno.

Recomendacion: mantener las validaciones de telefono y campos obligatorios en schemas/use-cases, no solo en UI.

### `src/features/services`

Servicios esta bien separado y ya soporta categorias de precio fijo/variable.

Estado: bueno.

Riesgo: la UI de servicios sigue siendo grande y puede crecer con futuras reglas.

Recomendacion: separar formularios de categoria, servicio y listado.

### `src/features/reminders`

Recordatorios esta separado y tiene buena orientacion operativa.

Estado: bueno.

Recomendacion: seguir cuidando que los recordatorios manuales no se mezclen con automatizaciones futuras sin una decision clara. Si se agregan recordatorios automaticos reales, deben ser otro flujo o job bien documentado.

### `src/features/employees`

Modulo grande, pero necesario por roles, disponibilidad y colaboradores.

Estado: bueno.

Recomendacion: seguir evitando que permisos y disponibilidad vivan en componentes de UI.

### `src/features/platform`

Platform concentra super admin, salones y configuraciones globales.

Estado: bueno.

Riesgo: al tener permisos altos, cualquier uso de `service_role` debe mantenerse aislado y documentado.

### `src/features/access`

Buen modulo para permisos, roles y feature flags.

Estado: fuerte.

Lo positivo:

- `inventory`, `retail` y `expenses` pueden bloquearse por feature flags.
- La arquitectura permite ocultar UI y bloquear rutas/acciones.

Recomendacion: mantener tests de URL bloqueada cuando una feature esta deshabilitada.

### `src/components`

`components/ui` se mantiene principalmente libre de dominio, que es lo correcto. Los componentes base no deberian saber de salones, citas, inventario ni gastos.

Estado: bueno.

Riesgo: si se empieza a meter logica de negocio en componentes compartidos, se rompe la Locality del monolito modular.

Recomendacion: componentes compartidos solo para UI; reglas de negocio siempre en `features`.

### `src/lib`

`src/lib` funciona como infraestructura compartida: Supabase, auth, sesiones, utilidades y tipos comunes.

Estado: bueno.

Riesgo: `src/lib` puede convertirse en carpeta comodin si se agregan reglas de negocio ahi.

Recomendacion: mantener `lib` como Adapter/infraestructura, no como dominio.

### `src/test`

La suite de tests actual paso correctamente.

Estado: bueno.

Riesgo: las pruebas unitarias son buenas, pero el proyecto necesita mas pruebas de flujos completos para produccion:

- crear cita,
- completar cita con precios variables,
- venta de vitrina,
- compra de inventario desde gastos,
- transferencia de stock,
- bloqueo multi-tenant.

## Analisis SOLID

### Single Responsibility

Buen cumplimiento en `src/features`. Cada modulo tiene responsabilidad clara.

Debilidad actual: algunos managers de `src/app` concentran demasiadas responsabilidades visuales y de estado.

### Open/Closed

El proyecto permite agregar features nuevas sin romper todo, especialmente por el patron de feature flags y permisos.

Debilidad actual: reportes y dashboard requieren editar agregadores cada vez que aparece una nueva fuente de ingreso o egreso.

### Liskov Substitution

No hay jerarquias complejas, asi que no hay riesgo fuerte aqui.

### Interface Segregation

Aceptable, pero `inventory.repo.ts` empieza a ser una Interface amplia.

Recomendacion: separar lecturas, comandos de stock y compras si sigue creciendo.

### Dependency Inversion

Los use-cases dependen de funciones concretas de repositorio. Para el tamano actual es correcto; abstraer mas ahora podria crear complejidad innecesaria.

Donde si conviene invertir mejor la dependencia es en reportes/dashboard: deberian depender de un read model operativo, no de detalles de cada modulo.

## Oportunidades De Mejora

### 1. Transaccion Atomica De Inventario Y Vitrina

Prioridad: alta.

Problema:

Los flujos de stock, compras y ventas hacen varias escrituras separadas. Eso puede dejar datos inconsistentes si falla una escritura intermedia.

Archivos relacionados:

- `src/features/inventory/use-cases/stock-commands.ts`
- `src/features/inventory/data/inventory.repo.ts`
- `src/features/retail/use-cases/retail-sales.ts`
- `src/features/inventory/use-cases/inventory-products.ts`
- `supabase/migrations`

Mejora:

Crear funciones SQL/RPC transaccionales para:

- registrar movimiento de inventario,
- registrar compra de inventario,
- registrar venta de vitrina.

Beneficio:

- Mas consistencia.
- Menos errores en produccion.
- Mejor Locality.
- Menos codigo defensivo en TypeScript.

### 2. Gate De Migraciones Antes De Produccion

Prioridad: alta.

Problema:

Ya ocurrio que produccion recibio codigo que necesitaba migraciones pendientes.

Mejora:

Agregar un script/runbook de release que confirme que la base de produccion tiene las migraciones esperadas antes de dar por listo el deploy.

Beneficio:

- Evita pantallas rotas por tablas/columnas faltantes.
- Reduce dependencia de memoria manual.
- Da confianza antes de ofrecer el sistema a salones reales.

### 3. Read Model De Ingresos/Egresos Operativos

Prioridad: media.

Problema:

Reportes y dashboard leen varias fuentes: citas, vitrina, gastos y compras.

Mejora:

Crear un Module de lectura operativa que exponga:

- ingresos por citas,
- ingresos por vitrina,
- gastos generales,
- compras de inventario,
- utilidad estimada.

Nota:

Si se implementa, conviene actualizar `CONTEXT.md` con el nombre del concepto. Puede llamarse `Egreso operativo`, `Ingreso operativo` o `Resumen financiero operativo`.

### 4. Dividir Managers Grandes De UI

Prioridad: media.

Problema:

Algunos archivos de `src/app` son grandes y mezclan muchas pantallas internas.

Mejora:

Separar en componentes locales:

- `InventorySummary`
- `InventoryTabs`
- `ProductList`
- `TransferStockForm`
- `ExpenseHistory`
- `ExpenseForm`
- `RetailSaleForm`
- `RetailProductList`

Beneficio:

- Menos codigo monstruo.
- Mas facil corregir UI sin tocar reglas.
- Mejor mantenibilidad.

### 5. Narrow Interfaces Para Vitrina Y Gastos

Prioridad: media-baja.

Problema:

Vitrina consume una vista amplia de inventario y gastos conoce detalles de compras.

Mejora:

Crear Interfaces mas pequenas:

- productos vendibles para vitrina,
- historial unificado de egresos,
- resumen de stock bajo.

Beneficio:

- Menor acoplamiento.
- Mas claridad sobre lo que cada modulo necesita.

## Deuda Tecnica Encontrada

No se encontro una ruptura grave de arquitectura despues de los cambios recientes.

Si hay deuda tecnica importante en:

- transacciones de inventario/vitrina/compras,
- managers grandes de UI,
- proceso de migraciones a produccion,
- agregadores de reportes/dashboard.

La deuda no impide seguir construyendo funciones, pero si debe atacarse antes de escalar a muchos salones.

## Preparacion Para Produccion

Para iniciar con hasta 10 salones, el sistema esta en un punto razonable si se cumplen estas condiciones:

- Migraciones aplicadas antes de cada deploy.
- Pruebas pasando antes de push.
- Validacion manual de rutas criticas.
- Backups y monitoreo activos en Supabase/Vercel.
- Cuidado al tocar citas, pagos, inventario y gastos.

Para una produccion nacional o crecimiento fuerte, falta:

- transacciones atomicas para inventario/vitrina/compras,
- pruebas E2E de flujos diarios,
- gate automatico de migraciones,
- observabilidad de errores,
- control mas fuerte de releases.

## Conclusion

GlowBook ya esta mucho mas cerca de un monolito modular sano que de una aplicacion improvisada. La organizacion por features esta funcionando, las ADRs respaldan decisiones importantes y los guardrails de arquitectura pasan.

La siguiente mejora no deberia ser otra reorganizacion masiva de carpetas. La prioridad real es profundizar los Modules que manejan dinero y stock, especialmente para que cada venta, compra o movimiento sea atomico y trazable.

Recomendacion de siguiente fase:

1. Implementar transacciones/RPC para inventario, vitrina y compras de inventario.
2. Crear gate de migraciones para produccion.
3. Dividir los managers grandes de UI.
4. Consolidar reportes/dashboard con un read model operativo de ingresos y egresos.

