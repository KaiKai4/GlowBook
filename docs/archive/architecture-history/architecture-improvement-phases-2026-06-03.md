# Fases De Mejora Arquitectonica - 2026-06-03

## Objetivo

Convertir los hallazgos de `docs/architecture-audit-current-state-2026-06-03.md` en fases concretas para mejorar:

- Modularidad general: de 8/10 a 9/10.
- Separacion de responsabilidades: de 7.5/10 a 9/10.
- Riesgo de deuda tecnica inmediata: de medio a bajo.

Estas fases no buscan rehacer el proyecto. La arquitectura actual de monolito modular ya esta bien encaminada. El trabajo debe enfocarse en reducir riesgos reales: operaciones que pueden quedar a medias, pantallas grandes, agregadores acoplados y proceso de migraciones.

## Principios De Ejecucion

- No mover carpetas por estetica.
- No crear abstracciones si no reducen deuda real.
- Mantener `src/app` como Interface de entrega.
- Mantener `src/features` como Modules de negocio.
- Mantener `src/lib` como infraestructura y Adapters compartidos.
- Mantener `components/ui` libre de dominio.
- Cada fase debe cerrar con `lint`, `type-check` y tests relevantes.
- No hacer commit/push hasta revisar visualmente si el usuario lo pide.

## Fase 0 - Cierre Del Estado Actual

Prioridad: inmediata.

Objetivo:

Dejar documentado y verificable el estado base antes de tocar arquitectura nuevamente.

Trabajo:

- Conservar la auditoria actual como documento de referencia.
- Conservar este documento como roadmap activo.
- Validar que no haya cambios accidentales sin revisar.
- Confirmar que el fix de `inventory-manager.tsx` no introduce regresiones.
- Ejecutar:
  - `npm.cmd run lint`
  - `npm.cmd run type-check`
  - `npm.cmd run test`

Criterio de completado:

- Auditoria y fases existen en `docs`.
- Guardrails de arquitectura pasan.
- Type-check pasa.
- Tests pasan.
- El arbol de trabajo tiene solo cambios esperados.

Riesgo que reduce:

- Evita seguir construyendo sobre un estado confuso.

## Fase 1 - Transacciones Atomicas Para Inventario, Vitrina Y Compras

Prioridad: alta.

Objetivo:

Evitar que una venta, compra o movimiento de stock quede a medias si Supabase falla entre escrituras.

Problema actual:

Los flujos nuevos hacen varias operaciones separadas:

- actualizar stock,
- crear movimiento,
- crear venta,
- crear item de venta,
- crear compra,
- crear item de compra.

Si una escritura falla despues de otra, puede quedar stock descontado sin venta, compra registrada sin movimiento o movimiento sin estado final correcto.

Trabajo:

- Crear una migracion con funciones SQL/RPC transaccionales.
- Reemplazar el flujo manual de `adjustInventoryStock` en operaciones criticas.
- Crear una funcion para movimiento de inventario:
  - valida stock suficiente,
  - actualiza stock,
  - crea `inventory_movements`.
- Crear una funcion para venta de vitrina:
  - valida stock suficiente,
  - crea `retail_sales`,
  - crea `retail_sale_items`,
  - descuenta stock,
  - crea movimiento.
- Crear una funcion para compra de inventario:
  - crea `inventory_purchases`,
  - crea `inventory_purchase_items`,
  - aumenta stock en bodega,
  - crea movimiento.
- Mantener las reglas multi-tenant con `salon_id` y RLS.
- Mantener los use-cases como Interface del modulo; la RPC debe ser Adapter/Implementation, no logica en UI.

Archivos probables:

- `supabase/migrations/*`
- `src/features/inventory/data/inventory.repo.ts`
- `src/features/inventory/use-cases/stock-commands.ts`
- `src/features/inventory/use-cases/inventory-products.ts`
- `src/features/retail/use-cases/retail-sales.ts`
- `src/features/expenses/use-cases/expenses.ts`

Criterio de completado:

- No existe flujo critico que descuente/aumente stock fuera de una operacion atomica.
- Venta sin stock suficiente falla sin modificar stock.
- Compra de inventario aumenta bodega y registra egreso en un mismo flujo.
- Movimiento de stock crea movimiento y actualiza stock juntos.
- Tests cubren venta, compra, transferencia y stock insuficiente.

Riesgo que reduce:

- Inconsistencia de inventario.
- Perdida de trazabilidad.
- Errores dificiles de auditar en produccion.

## Fase 2 - Gate De Migraciones Y Release Seguro

Prioridad: alta.

Objetivo:

Evitar que produccion vuelva a recibir codigo que depende de migraciones no aplicadas.

Problema actual:

El proyecto ya tuvo una ruptura porque Vercel ejecuto codigo nuevo contra una base de datos de produccion sin las migraciones necesarias.

Trabajo:

- Crear un script de verificacion de migraciones pendientes.
- Documentar un runbook de release.
- Separar claramente:
  - entorno local,
  - staging,
  - produccion.
- Agregar checklist antes de push/deploy:
  - verificar branch,
  - verificar proyecto Supabase destino,
  - verificar migraciones pendientes,
  - aplicar migraciones,
  - correr pruebas,
  - validar rutas criticas.
- Evitar imprimir secretos o URLs completas de base de datos.

Archivos probables:

- `scripts/*`
- `docs/runbooks/*`
- `docs/architecture-improvement-phases-2026-06-03.md`
- `package.json`

Criterio de completado:

- Existe comando claro para revisar migraciones antes de produccion.
- Existe runbook claro para aplicar migraciones.
- El proceso evita confundir staging con produccion.
- La documentacion explica que Vercel no aplica migraciones automaticamente.

Riesgo que reduce:

- Pantallas rotas en produccion.
- Errores por tablas o columnas faltantes.
- Despliegues incompletos.

## Fase 3 - Read Model De Ingresos Y Egresos Operativos

Prioridad: media-alta.

Objetivo:

Separar mejor la responsabilidad de reportes/dashboard para que no conozcan directamente todos los detalles de citas, vitrina, gastos y compras.

Problema actual:

Reportes y dashboard agregan datos desde varios modulos. Eso funciona, pero aumenta acoplamiento. Cada nueva fuente de dinero obliga a tocar varias partes.

Trabajo:

- Definir en `CONTEXT.md` el concepto de lectura operativa:
  - ingreso operativo,
  - egreso operativo,
  - utilidad estimada.
- Crear un Module o submodule de lectura operativa.
- Exponer una Interface unica para:
  - ingresos por citas,
  - ingresos por vitrina,
  - gastos generales,
  - compras de inventario,
  - utilidad estimada.
- Ajustar reportes para consumir esa Interface.
- Ajustar dashboard para consumir esa Interface.
- Mantener las fuentes tecnicas originales:
  - `appointments`,
  - `retail_sales`,
  - `expenses`,
  - `inventory_purchases`.

Archivos probables:

- `CONTEXT.md`
- `src/features/reports/*`
- `src/features/dashboard/*`
- `src/features/expenses/*`
- `src/features/retail/*`
- `src/features/inventory/*`

Criterio de completado:

- Dashboard no necesita saber como se calcula cada fuente de egreso.
- Reportes no importa directamente cada repo de dinero.
- La utilidad estimada se calcula desde un contrato unico.
- Las compras de inventario no se duplican como gastos manuales.

Riesgo que reduce:

- Acoplamiento entre features.
- Duplicacion de formulas.
- Reportes inconsistentes.

## Fase 4 - Dividir Managers Grandes De UI

Prioridad: media.

Objetivo:

Mejorar Locality y Single Responsibility en `src/app` sin mover reglas de negocio a UI.

Problema actual:

Algunas pantallas tienen managers grandes que mezclan formularios, filtros, tabs, listados, resumenes y acciones.

Trabajo:

- Dividir `inventory-manager.tsx` en componentes locales:
  - `InventoryStats`
  - `InventoryTabs`
  - `ProductList`
  - `ProductCard`
  - `TransferStockForm`
  - `NewProductForm`
  - `InventoryMovements`
- Dividir `expenses-manager.tsx`:
  - `ExpensesStats`
  - `ExpensesTabs`
  - `ExpenseForm`
  - `InventoryPurchaseExpenseForm`
  - `ExpenseHistory`
  - `ExpenseFilters`
- Dividir `retail-manager.tsx`:
  - `RetailStats`
  - `RetailSaleForm`
  - `RetailProductList`
  - `RetailSaleHistory`
- Revisar `services-manager.tsx` y `reminders-view.tsx` si siguen creciendo.
- Mantener los componentes en la carpeta de la ruta si son especificos de esa pantalla.
- No mover estos componentes a `components/ui` porque tienen dominio.

Archivos probables:

- `src/app/(dashboard)/inventory/*`
- `src/app/(dashboard)/expenses/*`
- `src/app/(dashboard)/retail/*`
- `src/app/(dashboard)/services/*`
- `src/app/(dashboard)/recordatorios/*`

Criterio de completado:

- Ningun manager nuevo supera una complejidad innecesaria.
- Cada formulario tiene su propio componente.
- Cada historial/listado tiene su propio componente.
- La UI queda mas facil de revisar visualmente.
- No se mueven reglas de negocio a componentes visuales.

Riesgo que reduce:

- Codigo monstruo.
- Cambios visuales que rompen logica.
- Dificultad para corregir errores pequenos.

## Fase 5 - Interfaces Mas Pequenas Para Vitrina, Inventario Y Gastos

Prioridad: media.

Objetivo:

Reducir acoplamiento entre modulos nuevos.

Problema actual:

Algunos flujos consumen vistas mas grandes de lo que necesitan. Por ejemplo, vitrina no necesita todo el estado de inventario; solo necesita productos vendibles, stock disponible y precio.

Trabajo:

- Crear una Interface especifica para productos vendibles en vitrina.
- Crear una Interface especifica para historial de egresos.
- Crear una Interface especifica para stock bajo/agregado.
- Evitar que un modulo consuma un page view completo de otro modulo si solo necesita una parte.

Archivos probables:

- `src/features/retail/use-cases/*`
- `src/features/inventory/use-cases/*`
- `src/features/expenses/use-cases/*`
- `src/features/inventory/data/*`

Criterio de completado:

- Vitrina consume una vista estrecha de productos vendibles.
- Gastos consume una vista clara de compras de inventario como egreso.
- Inventario mantiene sus comandos y lecturas separados.

Riesgo que reduce:

- Dependencias innecesarias.
- Cambios en inventario que rompen vitrina.
- Cambios en gastos que rompen reportes.

## Fase 6 - Pruebas De Flujos Criticos

Prioridad: media.

Objetivo:

Reducir riesgo de regresiones en los flujos diarios de un salon.

Trabajo:

- Agregar tests para:
  - crear cita,
  - completar cita con precio variable,
  - descuento por servicio,
  - venta de vitrina,
  - venta sin stock suficiente,
  - compra de inventario desde gastos,
  - transferencia de stock,
  - gasto general con concepto libre,
  - bloqueo por feature flag,
  - aislamiento multi-tenant.
- Revisar tests skipped si siguen existiendo.
- Separar unit tests de tests de integracion si hace falta.

Archivos probables:

- `src/test/*`
- `src/features/**/__tests__/*`
- `src/features/**/*.test.ts`

Criterio de completado:

- Los flujos nuevos tienen pruebas.
- La suite sigue pasando completa.
- Las pruebas cubren casos de error, no solo caminos felices.

Riesgo que reduce:

- Regresiones silenciosas.
- Errores que solo aparecen al usar la interfaz.
- Falta de confianza antes de produccion.

## Fase 7 - Limpieza De Documentacion Y ADRs Actuales

Prioridad: baja-media.

Objetivo:

Evitar confusion por documentos historicos que ya no representan el estado actual.

Trabajo:

- Marcar auditorias antiguas como historicas o moverlas a una carpeta de archivo.
- Mantener vivos:
  - ADRs,
  - runbooks,
  - auditoria actual,
  - fases actuales.
- No borrar documentos sin revisar contenido.
- Si se crea el concepto de ingresos/egresos operativos, agregarlo a `CONTEXT.md`.

Archivos probables:

- `docs/*`
- `docs/adr/*`
- `CONTEXT.md`

Criterio de completado:

- Es facil saber cual auditoria esta vigente.
- Las fases actuales estan alineadas con la arquitectura real.
- No hay documentos contradictorios guiando decisiones.

Riesgo que reduce:

- Confusion al retomar trabajo.
- Repeticion de auditorias.
- Decisiones basadas en estado viejo.

## Orden Recomendado

1. Fase 0 - Cierre del estado actual.
2. Fase 1 - Transacciones atomicas.
3. Fase 2 - Gate de migraciones.
4. Fase 3 - Read model de ingresos/egresos.
5. Fase 4 - Dividir managers grandes.
6. Fase 5 - Interfaces mas pequenas.
7. Fase 6 - Pruebas de flujos criticos.
8. Fase 7 - Limpieza documental.

## Avance Actual

### Fase 0 - Completada En Codigo

Estado: completada.

Evidencia:

- Existe la auditoria actual.
- Existe este roadmap de fases.
- `npm.cmd run lint` pasa.
- `npm.cmd run type-check` pasa.
- `npm.cmd run test` pasa.
- Los guardrails de arquitectura pasan.

### Fase 1 - Implementada En Codigo

Estado: implementada, pendiente de aplicar migracion en el entorno destino cuando se apruebe.

Cambios realizados:

- Se agrego la migracion `20240101000043_inventory_retail_atomic_operations.sql`.
- Se crearon operaciones atomicas para:
  - movimiento simple de stock,
  - transferencia de stock,
  - compra de inventario,
  - venta de vitrina.
- Los use-cases dejaron de ejecutar ventas, compras y transferencias como cadenas de escrituras sueltas.
- Se agregaron pruebas para confirmar que:
  - transferencias usan el Adapter atomico,
  - compras de inventario usan el Adapter atomico,
  - ventas de vitrina usan el Adapter atomico,
  - los errores reales de Supabase se conservan.

Nota:

La migracion nueva no debe asumirse aplicada en produccion hasta ejecutarla explicitamente contra el proyecto correcto de Supabase.

### Fase 2 - Implementada En Codigo

Estado: implementada.

Cambios realizados:

- Se agrego `scripts/production-migration-gate.mjs`.
- Se agregaron comandos:
  - `npm run staging:migrations`
  - `npm run release:migrations`
- Se actualizo `docs/runbooks/database-migrations.md`.
- Se actualizo `docs/runbooks/deploy.md`.

Regla nueva:

Antes de deployar codigo que depende de migraciones, el gate debe confirmar que el Supabase remoto tiene todas las versiones locales. Si faltan migraciones o el CLI no puede leer el historial remoto, el release queda bloqueado.

Nota:

El gate no aplica migraciones y no imprime URLs de base de datos.

### Fase 3 - Implementada En Codigo

Estado: implementada.

Cambios realizados:

- Se agrego el vocabulario de dinero operativo en `CONTEXT.md`.
- Se creo `src/features/finance`.
- Se agrego un read model para:
  - ingresos de vitrina,
  - gastos generales,
  - compras de inventario,
  - utilidad estimada.
- Dashboard y reportes dejaron de importar directamente los repos de gastos, vitrina y compras de inventario.
- Se agregaron pruebas para:
  - calculo de dinero operativo,
  - lectura de fuentes externas de dinero,
  - dashboard usando el nuevo contrato,
  - reportes usando el nuevo contrato.

Regla nueva:

Dashboard y reportes deben consumir el resumen financiero operativo, no consultar cada fuente tecnica de dinero por separado.

### Fase 4 - Implementada En Codigo

Estado: implementada y validada.

Cambios realizados:

- `retail-manager.tsx` fue dividido en componentes locales:
  - `RetailStats`
  - `RetailTabs`
  - `RetailSaleForm`
  - `RetailSalesHistory`
  - `RetailProductList`
- `expenses-manager.tsx` fue dividido en componentes locales:
  - `ExpensesStats`
  - `ExpensesTabs`
  - `ExpenseGeneralForm`
  - `InventoryPurchaseExpenseForm`
  - `ExpensesHistory`
- `inventory-manager.tsx` fue dividido en componentes locales:
  - `InventoryStats`
  - `InventoryTabs`
  - `TransferStockForm`
  - `NewProductForm`
  - `InventoryProductList`
  - `InventoryMovementsList`
- Los managers de Vitrina, Gastos e Inventario quedaron como coordinadores de estado, feedback y acciones.
- Los formularios/listados quedaron separados por responsabilidad local de pantalla.

Validacion:

- `npm.cmd run type-check` pasa.
- `npm.cmd run lint` pasa.
- `npm.cmd run test` pasa con 60 archivos y 167 pruebas.

Regla nueva:

Los componentes extraidos se mantienen dentro de cada ruta porque contienen UI de dominio. No deben moverse a `components/ui`.

### Fase 5 - Implementada En Codigo

Estado: implementada y validada parcialmente por type-check.

Cambios realizados:

- Vitrina dejo de consumir `getInventoryPage`.
- Se agrego `getRetailInventoryProducts` como lectura estrecha para productos vendibles:
  - `id`
  - `name`
  - `category`
  - `salePrice`
  - stock por ubicacion
- Gastos dejo de cargar la pagina completa de Inventario para compras.
- Se agrego `getInventoryProductOptions` para que Gastos solo reciba opciones de producto:
  - `id`
  - `name`
- Gastos dejo de mapear la estructura tecnica de compras desde `inventory.repo`.
- Se agrego `getInventoryPurchaseExpenseHistory` para exponer compras de inventario como egresos operativos.
- Dashboard dejo de consumir `getInventoryPage` para contar stock bajo.
- Se agrego `getLowStockSummary` como resumen estrecho para metricas.

Regla nueva:

Los modulos que solo necesitan un resumen o selector no deben importar page views completos de otros modulos. Deben usar una lectura estrecha del modulo propietario.

### Fase 6 - Implementada En Codigo

Estado: implementada para los flujos recientes y contratos de modulo.

Cambios realizados:

- Se confirmo cobertura existente para:
  - crear cita,
  - completar cita con precio variable,
  - descuento por servicio,
  - venta de vitrina,
  - venta sin stock suficiente,
  - compra de inventario,
  - transferencia de stock,
  - bloqueo por feature flags,
  - casos de aislamiento/RPC cuando el entorno lo permite.
- Se agregaron pruebas para los contratos nuevos de fase 5:
  - `getRetailInventoryProducts`,
  - `getInventoryProductOptions`,
  - `getLowStockSummary`,
  - `getInventoryPurchaseExpenseHistory`.
- Se revisaron pruebas skipped:
  - `salon-overviews.rpc.test.ts` se ejecuta solo con entorno de integracion configurado.
  - `create-appointment.rpc.test.ts` se ejecuta solo con `RUN_RPC_TESTS`.

Validacion:

- `npm.cmd run type-check` pasa.
- `npm.cmd run test` pasa con 64 archivos y 171 pruebas.
- `npm.cmd run lint` pasa.
- Los guardrails de arquitectura pasan.

### Fase 7 - Implementada En Documentacion

Estado: implementada.

Cambios realizados:

- Se creo `docs/archive/architecture-history/README.md`.
- Se archivaron auditorias, verificaciones y planes historicos de arquitectura en `docs/archive/architecture-history/`.
- Se mantuvieron vivos:
  - ADRs,
  - runbooks,
  - auditoria vigente,
  - fases actuales,
  - documentos operativos de seguridad, entornos, testing, capacidad y readiness.
- Se actualizo `docs/README.md` para apuntar a:
  - `docs/architecture-audit-current-state-2026-06-03.md`,
  - `docs/architecture-improvement-phases-2026-06-03.md`,
  - `docs/archive/architecture-history/README.md`.
- `CONTEXT.md` ya contiene el concepto de ingresos/egresos operativos agregado en fase 3.

Regla nueva:

Los documentos historicos archivados son trazabilidad, no fuente vigente de decision.

## Resultado Esperado

Al terminar estas fases, GlowBook deberia quedar con:

- Modularidad general cercana a 9/10.
- Separacion de responsabilidades cercana a 9/10.
- Riesgo de deuda tecnica inmediata bajo.
- Menos posibilidad de rupturas en produccion.
- Inventario, vitrina y gastos mas confiables.
- Reportes y dashboard menos acoplados.
- Pantallas mas faciles de mantener.
