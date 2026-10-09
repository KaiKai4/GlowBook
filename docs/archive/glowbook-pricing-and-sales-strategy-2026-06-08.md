# GlowBook: Estrategia de Venta y Planes Mensuales

Fecha: 2026-06-08  
Estado: propuesta inicial basada en benchmark de staging  
Objetivo: definir como vender GlowBook de forma rentable, clara para salones y sostenible para infraestructura.

## Regla De Implementacion

Los planes, precios, limites, modulos incluidos y add-ons no deben estar hardcodeados en la aplicacion.

Todo debe administrarse desde Superadmin:

- crear y editar planes;
- activar o pausar planes;
- definir precio mensual;
- definir trial;
- definir limites por feature;
- activar o desactivar modulos por plan;
- asignar plan a un salon;
- asignar add-ons a un salon;
- ver uso mensual por salon.

El codigo solo debe conocer el concepto de entitlement y consultar la configuracion vigente. Las recomendaciones de precios de este documento son guia comercial, no configuracion fija del producto.

## 1. Resumen Ejecutivo

GlowBook debe venderse como un sistema operativo para salones, no como una agenda simple.

La propuesta de valor principal no es "guardar clientes" ni "tener calendario", sino ayudar al salon a:

- organizar citas sin caos;
- reducir olvidos con recordatorios;
- controlar colaboradores;
- cobrar y registrar servicios;
- vender productos de vitrina;
- controlar inventario;
- entender ingresos, gastos y ganancias.

La estrategia recomendada es vender por nivel de operacion del salon:

- salones que solo necesitan agenda;
- salones que trabajan con varios colaboradores;
- salones que venden productos o registran gastos;
- salones que necesitan control completo de inventario y reportes.

No conviene vender por cantidad de clientes como limite principal. El benchmark muestra que el peso real del sistema crece sobre todo por citas, items de cita, recordatorios y movimientos operativos.

## 2. Datos Medidos Hasta Ahora

Benchmark ejecutado en staging: `pricing-benchmark-v2-20260608`

Resultado parcial valido:

- 40 salones creados.
- Cohortes completas: A, B, C y D.
- Cohorte E de stress no se completo para evitar seguir subiendo el uso de staging.
- Staging DB total despues del benchmark: aproximadamente 745 MB.
- Tablas funcionales principales: aproximadamente 731 MB.

### Peso Promedio Por Tipo De Salon

| Cohorte | Tipo de salon | MB aprox. por salon |
|---|---:|---:|
| A | Agenda minima | 2.5 MB |
| B | Salon pequeno realista | 5.1 MB |
| C | Salon mediano con vitrina y gastos | 17.3 MB |
| D | Salon completo con inventario | 48.1 MB |

### Tablas Mas Pesadas

| Tabla | Tamano aprox. |
|---|---:|
| `appointment_items` | 348 MB |
| `appointments` | 270 MB |
| `customers` | 30 MB |
| `inventory_movements` | 19 MB |
| `appointment_reminder_log` | 18 MB |

Conclusion tecnica: el costo de datos crece principalmente por:

1. citas;
2. servicios dentro de cada cita;
3. historial de recordatorios;
4. movimientos de inventario;
5. ventas y gastos.

Clientes, categorias y servicios pesan mucho menos que la actividad diaria.

## 3. Costos Base De Infraestructura

Fuentes:

- Supabase Pricing: https://supabase.com/pricing
- Supabase Billing Docs: https://supabase.com/docs/guides/platform/billing-on-supabase
- Vercel Pricing: https://vercel.com/pricing
- Vercel Pro Trial Docs: https://vercel.com/docs/plans/pro/trials

### Supabase

Supabase Free:

- 500 MB database size.
- 5 GB egress.
- No es suficiente para benchmarks reales ni produccion comercial.

Supabase Pro:

- desde USD 25/mes.
- 8 GB disk size incluido por proyecto.
- 250 GB egress incluido.
- despues de 8 GB: USD 0.125/GB adicional.
- despues de 250 GB egress: USD 0.09/GB adicional.

Lectura para GlowBook:

- El storage extra no parece el riesgo principal porque es barato.
- El riesgo real sera egress, consultas pesadas, cantidad de lecturas y performance.
- En Pro, 8 GB alcanzan para empezar, pero se debe monitorear crecimiento mensual.

### Vercel

Vercel Pro:

- normalmente se usa para proyectos comerciales.
- incluye limites mas altos de funciones, transferencia y colaboracion.
- referencia publica: Pro maneja beneficios como 1 TB Fast Data Transfer y 10M Edge Requests en documentos de trial/pro.

Lectura para GlowBook:

- Vercel probablemente no sera el primer cuello de botella.
- Si la app se siente lenta, primero revisar consultas y server actions.
- Vercel se vuelve caro si cada pantalla recalcula demasiado o si se envian respuestas muy grandes.

## 4. Principio De Pricing

GlowBook debe cobrar por valor operativo y por consumo real aproximado.

No vender principalmente por:

- cantidad de clientes guardados;
- cantidad de servicios creados;
- cantidad de categorias.

Si vender por:

- volumen mensual de citas;
- colaboradores con acceso propio;
- modulos activos;
- reportes avanzados;
- inventario;
- vitrina;
- gastos;
- automatizaciones o recordatorios externos cuando existan.

La razon es simple: guardar un cliente pesa poco; operar miles de citas, items, recordatorios y movimientos pesa mucho mas.

## 5. Estructura Recomendada De Planes

Estos planes son una recomendacion inicial. Los precios finales deben validarse con medicion de rutas, egress y uso real en produccion.

### Plan 1: Agenda

Para salones pequenos que solo necesitan organizar citas.

Incluye:

- agenda diaria y semanal;
- clientes;
- servicios;
- 1 owner;
- 1 colaborador operativo sin acceso propio;
- recordatorios internos/manuales;
- dashboard basico;
- reportes basicos de citas.

Limites recomendados:

- hasta 300 citas/mes;
- hasta 500 clientes activos;
- hasta 2 colaboradores operativos;
- sin vitrina;
- sin inventario;
- sin gastos.

Precio sugerido inicial:

- USD 19/mes.

Justificacion:

- Basado en cohorte A/B, el peso estimado esta entre 2.5 MB y 5.1 MB por salon.
- Es un plan de entrada para reducir friccion de venta.

### Plan 2: Agenda Plus

Para salones que trabajan con varios profesionales y necesitan mas control.

Incluye:

- todo lo del plan Agenda;
- agenda por colaborador;
- permisos basicos;
- mas colaboradores operativos;
- recordatorios mejor organizados;
- reportes de citas mas utiles;
- busqueda y paginacion avanzada.

Limites recomendados:

- hasta 800 citas/mes;
- hasta 1,500 clientes activos;
- hasta 5 colaboradores operativos;
- 1 o 2 colaboradores con acceso propio incluidos;
- sin inventario;
- vitrina opcional como add-on;
- gastos opcional como add-on.

Precio sugerido inicial:

- USD 35/mes.

Justificacion:

- Cubre salones pequenos/medianos donde el valor no esta solo en agendar, sino en coordinar equipo.

### Plan 3: Negocio

Para salones que ya quieren medir dinero, vender productos y controlar gastos.

Incluye:

- todo lo del plan Agenda Plus;
- vitrina;
- ventas de productos;
- gastos operativos;
- reportes financieros;
- metricas de ingresos, egresos y ganancias;
- metodos de pago configurables;
- cierre mensual basico.

Limites recomendados:

- hasta 2,000 citas/mes;
- hasta 4,000 clientes activos;
- hasta 8 colaboradores operativos;
- hasta 3 colaboradores con acceso propio incluidos;
- vitrina incluida;
- gastos incluidos;
- inventario basico opcional.

Precio sugerido inicial:

- USD 59/mes.

Justificacion:

- Cohorte C pesa aproximadamente 17.3 MB por salon.
- El salon ya recibe valor financiero directo: ventas, gastos y ganancias.

### Plan 4: Completo

Para salones con operacion mas grande, inventario y reportes completos.

Incluye:

- todo lo del plan Negocio;
- inventario completo;
- reposiciones;
- movimientos de inventario;
- stock minimo;
- reportes completos;
- alertas operativas;
- control por modulo;
- soporte prioritario basico.

Limites recomendados:

- hasta 5,000 citas/mes;
- hasta 10,000 clientes activos;
- hasta 15 colaboradores operativos;
- hasta 5 colaboradores con acceso propio incluidos;
- vitrina incluida;
- gastos incluidos;
- inventario incluido.

Precio sugerido inicial:

- USD 89/mes.

Justificacion:

- Cohorte D pesa aproximadamente 48.1 MB por salon.
- Este tipo de cliente usa todos los modulos y obtiene valor administrativo real.

## 6. Add-ons Recomendados

Los add-ons permiten que el precio base no se vuelva caro para salones pequenos, pero que los salones mas grandes paguen proporcionalmente mas.

| Add-on | Precio sugerido |
|---|---:|
| Colaborador con acceso propio adicional | USD 5/mes |
| Bloque adicional de 1,000 citas/mes | USD 5 a 10/mes |
| Vitrina como add-on | USD 10/mes |
| Gastos como add-on | USD 8 a 10/mes |
| Inventario como add-on | USD 15 a 20/mes |
| Reportes avanzados | USD 10/mes |
| Dominio personalizado o marca blanca futura | USD 10 a 20/mes |

Regla: los add-ons deben cobrar por valor, no solo por costo tecnico.

Ejemplo:

- Un colaborador con login propio no cuesta mucho en storage, pero agrega valor y soporte.
- Inventario pesa mas por movimientos y reportes; debe ser add-on caro o plan superior.

## 7. Limites Que Deben Existir En El Sistema

Los limites no deben ser solo visuales. Deben aplicarse en servidor.

### Limites por plan

- citas creadas por mes;
- clientes activos;
- colaboradores operativos;
- usuarios con acceso propio;
- productos de vitrina;
- productos de inventario;
- movimientos de inventario;
- reportes avanzados;
- historial visible.

### Validaciones necesarias

Antes de crear una cita:

- validar limite mensual de citas;
- validar si el salon esta activo;
- validar si la suscripcion esta vigente.

Antes de crear colaborador con acceso:

- validar cupo de usuarios con login;
- validar add-on o plan.

Antes de activar modulo:

- validar que el plan lo incluya;
- si no, mostrar upgrade.

Antes de crear producto/inventario:

- validar modulo;
- validar limites del plan.

## 8. Implementacion Tecnica Necesaria

### Tablas nuevas recomendadas

`billing_plans`

- id
- code
- name
- monthly_price_usd
- is_active
- created_at

`billing_features`

- key
- name
- description
- value_kind
- usage_metric
- unit
- is_active

`billing_plan_entitlements`

- id
- plan_id
- feature_key
- limit_value
- created_at

Ejemplos de `feature_key`:

- `appointments.monthly_limit`
- `customers.active_limit`
- `collaborators.operational_limit`
- `collaborators.login_limit`
- `module.retail`
- `module.inventory`
- `module.expenses`
- `reports.advanced`

`billing_salon_subscriptions`

- id
- salon_id
- plan_id
- status
- current_period_start
- current_period_end
- cancel_at_period_end
- trial_ends_at
- created_at
- updated_at

`billing_salon_addons`

- id
- salon_id
- addon_key
- quantity
- status
- created_at
- updated_at

`billing_salon_usage_snapshots`

- id
- salon_id
- period_month
- appointments_created
- appointments_completed
- active_customers
- collaborators_total
- login_users_total
- retail_sales_total
- inventory_movements_total
- expenses_total
- estimated_storage_mb
- created_at

`billing_usage_events`

- id
- salon_id
- event_type
- quantity
- occurred_at
- metadata

### Servicios internos necesarios

Crear una capa de dominio para billing/entitlements:

- `canCreateAppointment(salonId)`
- `canCreateCustomer(salonId)`
- `canInviteCollaborator(salonId)`
- `canUseModule(salonId, moduleKey)`
- `getSalonPlanUsage(salonId)`
- `recordUsageEvent(...)`

No conviene que cada pagina consulte limites por su cuenta. Debe existir un servicio central.

## 9. Reportes Internos Para Ti Como Dueña

Necesitas un dashboard de plataforma para tomar decisiones de negocio.

Metricas clave:

- MRR estimado;
- salones activos;
- salones por plan;
- citas creadas por mes;
- storage estimado por salon;
- top 10 salones mas pesados;
- top 10 salones con mas citas;
- modulos mas usados;
- egress estimado;
- rutas lentas;
- errores por plan;
- salones cerca de limite.

Alertas internas:

- salon al 80% del limite de citas;
- salon al 90% del limite de usuarios;
- salon con crecimiento anormal de citas;
- salon con demasiada actividad en reportes;
- salon grande pagando plan pequeno.

## 10. Estrategia Comercial

### Mensaje principal

GlowBook no se vende como "software de citas".

Se vende como:

"La plataforma para que tu salon organice citas, clientes, equipo, ventas y ganancias en un solo lugar."

### Dolor por tipo de cliente

Salon pequeno:

- pierde citas;
- olvida clientes;
- agenda por WhatsApp de forma desordenada;
- no sabe cuantas citas hizo al mes.

Mensaje:

"Organiza tu agenda y evita olvidos desde el primer dia."

Salon con colaboradores:

- no sabe quien atiende que;
- se cruzan horarios;
- no hay visibilidad por trabajador;
- todo depende de una persona.

Mensaje:

"Coordina tu equipo sin confundir horarios ni servicios."

Salon que vende productos:

- vende pero no registra;
- no sabe cuanto gano;
- mezcla dinero de citas y productos;
- no controla gastos.

Mensaje:

"Conoce cuanto entra, cuanto sale y cuanto gana tu salon."

Salon con inventario:

- se queda sin productos;
- compra tarde;
- no sabe que se vende mas;
- pierde dinero por falta de control.

Mensaje:

"Controla productos, stock y reposiciones sin hojas de calculo."

## 11. Politica De Prueba Gratis

Recomendacion:

- prueba gratis de 7 a 14 dias;
- sin tarjeta al inicio para salones pequenos;
- con limite bajo de citas;
- sin cargar data masiva durante trial.

Limites sugeridos del trial:

- maximo 50 citas;
- maximo 50 clientes;
- maximo 2 colaboradores;
- sin inventario completo;
- sin reportes avanzados.

El objetivo del trial es activar el habito, no regalar operacion completa.

## 12. Politica De Historial

Para cuidar costos:

- planes bajos pueden ver historial detallado de 6 a 12 meses;
- planes altos pueden ver 24 meses o mas;
- reportes historicos deben usar agregados mensuales;
- citas antiguas pueden archivarse despues de cierto tiempo.

Importante: archivar no significa borrar el valor del reporte. Significa no consultar siempre el detalle completo.

## 13. Que Hay Que Medir Antes De Fijar Precios Finales

Todavia falta medir:

- egress real de Supabase por ruta;
- peso de dashboard;
- peso de agenda semanal;
- peso de reportes;
- busqueda de clientes;
- completar cita;
- ventas de vitrina;
- movimientos de inventario;
- acciones de gastos;
- cantidad de consultas por pantalla;
- tiempo promedio de server actions;
- consumo de Vercel Functions.

Sin eso, los precios recomendados son buenos para empezar, pero no definitivos.

## 14. Reglas Para No Perder Dinero

1. Ningun plan comercial debe costar menos de USD 19/mes.
2. Los colaboradores con acceso propio deben cobrarse.
3. Inventario no debe estar en el plan base.
4. Reportes avanzados no deben estar en el plan base.
5. Las citas mensuales deben tener limites.
6. Los salones grandes no deben quedar pagando como salones pequenos.
7. El trial debe tener limites claros.
8. El dashboard de plataforma debe mostrar uso por salon.
9. Debe existir una forma de pausar o bloquear salones morosos.
10. Todo limite importante debe validarse en backend.

## 15. Recomendacion Final

La estructura recomendada para salir al mercado es:

| Plan | Precio inicial | Cliente ideal |
|---|---:|---|
| Agenda | USD 19/mes | Salon pequeno que solo agenda |
| Agenda Plus | USD 35/mes | Salon con varios colaboradores |
| Negocio | USD 59/mes | Salon con ventas, gastos y control financiero |
| Completo | USD 89/mes | Salon con inventario y operacion completa |

Add-ons:

- USD 5 por colaborador con acceso propio adicional.
- USD 5 a 10 por cada bloque extra de 1,000 citas mensuales.
- USD 10 por vitrina si se vende separado.
- USD 15 a 20 por inventario si se vende separado.
- USD 10 por reportes avanzados.

Esta estructura permite:

- entrada barata para salones pequenos;
- crecimiento natural hacia planes superiores;
- cobrar mas cuando el salon usa mas sistema;
- proteger margen;
- evitar que un salon grande consuma mucho pagando poco.

## 16. Siguiente Fase Recomendada

1. Crear las tablas de planes, suscripciones, add-ons y uso.
2. Crear servicio central de entitlements.
3. Agregar limites en server actions.
4. Crear dashboard interno de uso por salon.
5. Medir rutas de Vercel y Supabase en lectura.
6. Definir precios finales con margen real.
7. Limpiar o reducir staging si sigue en Free.
