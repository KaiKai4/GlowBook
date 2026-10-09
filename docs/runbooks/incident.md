# Runbook: Respuesta A Incidentes

Runbook vigente de incidentes. Fusiona el antiguo `incidents.md` (escenarios
concretos, plantilla de postmortem y readiness de soporte), que queda archivado
en `docs/archive/runbooks-superseded/incidents.md`.

## Objetivo

Responder con orden a fallos en producción: detectar, clasificar, mitigar,
comunicar y aprender. La sección "Escenarios Concretos" describe respuestas
específicas (datos cruzados, citas, Supabase lento, reportes lentos).

## Fuentes De Deteccion

- Alerta del check sintético (`synthetic.yml`, issue con etiqueta
  `synthetic-failure`). Ver `synthetic-checks.md`.
- Reporte de un salón o del owner de soporte (`docs/launch-support.md`).
- Alertas de observabilidad (`docs/security.md`, variables
  `GLOWBOOK_OBSERVABILITY_*`).
- Fallos del job nightly (`nightly.yml`) o de CI sobre `main`.

## Severidad

| Severidad | Criterio | Respuesta esperada |
|---|---|---|
| SEV1 | Sospecha o confirmación de datos cruzados entre salones, pérdida de datos, login global caído. | Congelar deploys de inmediato. Responsable técnico y de comunicación se activan. Valorar rollback o restore. |
| SEV2 | Citas no se crean, errores 5xx en rutas críticas, login caído solo para un subconjunto, Supabase degradado. | Triage en menos de 30 min. Mitigar y decidir rollback en la misma ventana. |
| SEV3 | Reportes lentos, UI menor rota, latencia alta sin errores. | Registrar y priorizar en el siguiente ciclo. |

Ante la duda entre dos severidades, usar la más alta y bajarla al confirmar.

## Roles

- **Responsable de incidente**: coordina, decide y lleva la línea de tiempo.
  Puede ser cualquier persona del equipo de guardia.
- **Responsable técnico**: revisa Vercel, Supabase y deploys.
- **Responsable de comunicación**: avisa a salones y registra lo comunicado.
- Owner de soporte y owner suplente: ver `docs/launch-support.md`. El suplente
  debe estar definido antes de lanzamiento amplio.

## Flujo

### 1. Detectar Y Abrir

1. Abrir el incidente: hora de detección (UTC), fuente, severidad inicial.
2. Crear un hilo o documento de incidente con la línea de tiempo. Usar solo
   identificadores (salón por id, usuario por id, nunca nombre completo ni
   correo en el hilo).

### 2. Triage

1. Pedir o capturar el **`x-request-id`** de la respuesta fallida. Es el UUID
   que devuelve la app en cada respuesta y es la clave para encontrar la
   traza. Si no hay, usar la ruta, el salón y la hora aproximada.
2. Buscar esa traza en **Vercel Logs** (función y duración) y en los **logs de
   Supabase** (errores de RPC o de RLS). Revisar `platform_audit_log` si el
   fallo afecta al panel de plataforma.
3. Confirmar alcance: ¿un salón, varios o todos? ¿qué rutas?
4. Comprobar si empezó después de un deploy: revisar el último despliegue en
   Vercel y los commits de `main`.
5. Clasificar la severidad definitiva y anotarla.

### 3. Mitigar

Orden de preferencia, de menor a mayor impacto:

1. **Workaround** documentado en "Escenarios Concretos" (o en el escenario
   equivalente).
2. **Rollback de frontend** si el fallo empezó con un deploy:

   ```text
   vercel rollback <url-del-deployment-anterior-sano> --scope <equipo>
   ```

   También se puede hacer desde el dashboard de Vercel (Deployments > promover
   un deployment anterior). Verificar después con el check sintético sobre
   producción.
3. **Restore de base de datos** solo para pérdida de datos o corrupción. Seguir
   `restore.md`. Nunca como primera respuesta a un error de aplicación.
4. **Pausar una función** (por ejemplo, reportes pesados) si hay un workaround
   de bajo riesgo.

No hacer cambios directos en la base de datos de producción durante el
incidente salvo que el responsable técnico lo apruebe y quede registrado.

### 4. Comunicar

- SEV1: comunicar a los salones afectados en la primera hora, con lo que se
  sabe y lo que se está haciendo. Actualizar cada hora.
- SEV2: comunicar si hay impacto visible para el salón.
- SEV3: comunicar solo si el salón lo reportó.
- Nunca publicar en el hilo tokens, URLs de webhooks, claves, datos de
  clientes finales ni capturas con datos personales.
- Registrar en el incidente cada mensaje enviado: hora, canal, destinatarios
  (por id de salón).

### 5. Resolver Y Verificar

1. Confirmar con el check sintético (`workflow_dispatch` de `synthetic.yml`) y
   con un caso manual en el flujo afectado.
2. Confirmar que no hay errores nuevos en Vercel Logs durante al menos 30 min.
3. Declarar el incidente mitigado y después resuelto, con hora.
4. Reactivar los deploys congelados solo cuando el responsable técnico lo
   confirme.

### 6. Postmortem

Obligatorio para SEV1 y SEV2. Recomendado para SEV3 con causa no obvia.
Plazo: 5 días hábiles.

Estructura:

- Resumen, severidad, duración y salones afectados (número, no nombres).
- Línea de tiempo en UTC.
- Detección: cómo se supo y cuánto tardó.
- Causa raíz y factores contribuyentes.
- Qué funcionó, qué no, qué faltó (incluido runbook o alerta).
- Acciones correctivas con dueño, fecha y enlace a issue.
- Revisión de si el check sintético o las alertas habrían detectado antes el
  fallo.

Los postmortems se revisan en la siguiente reunión de operación. Sin culpables:
buscar causas en procesos y sistemas.

Plantilla de registro:

```text
Fecha:
Severidad:
Salones afectados:
Impacto:
Inicio:
Deteccion:
Mitigacion:
Resolucion:
Causa raiz:
Acciones preventivas:
Owner:
```

## Escenarios Concretos

### Incidente: Sospecha De Datos Cruzados

1. Pausar deploys.
2. Registrar Salon, usuario, ruta y hora.
3. Revisar Vercel Logs y Supabase logs.
4. Revisar `platform_audit_log` si aplica.
5. Intentar reproducir con fixtures multi-tenant.
6. Si se confirma, tratar como SEV1.
7. Preparar comunicacion y postmortem.

### Incidente: Citas No Se Crean

1. Revisar errores en Vercel Logs.
2. Revisar Supabase RPC `create_appointment`.
3. Confirmar si afecta un Salon o todos.
4. Ejecutar E2E de cita en staging si hay tiempo.
5. Si empezo despues de deploy, evaluar rollback.

### Incidente: Supabase Lento

1. Revisar Supabase status/dashboard.
2. Revisar advisors/logs.
3. Revisar rutas lentas en Vercel.
4. Reducir acciones de alto costo si hay workaround.
5. Escalar plan/proveedor si los limites lo explican.

### Incidente: Salon Suspendido Por Error

1. Revisar `platform_audit_log`.
2. Confirmar actor y hora.
3. Reactivar desde Platform si corresponde.
4. Registrar decision con owner de soporte.
5. Revisar si falta confirmacion adicional en UI/runbook.

### Incidente: Reportes Lentos

1. Revisar dataset/tamano del Salon.
2. Revisar Vercel Function duration.
3. Revisar Supabase logs/advisors.
4. Si se repite, abrir performance review.

## Checklist Rapida

- [ ] Severidad y hora registradas
- [ ] x-request-id o ruta/salón/hora capturados
- [ ] Logs de Vercel y Supabase revisados
- [ ] Deploys congelados si aplica
- [ ] Mitigación elegida y registrada
- [ ] Comunicación enviada y registrada
- [ ] Verificación con check sintético
- [ ] Postmortem programado (SEV1/SEV2)

## Readiness

Antes de activar `SCALE_SUPPORT_CONFIRMED=true`, ejecutar:

```text
npm run support:readiness
```

Para lanzamiento amplio con canales reales:

```text
GLOWBOOK_SUPPORT_REQUIRE_CONFIRMED_CHANNELS=true
GLOWBOOK_SUPPORT_OWNER=
GLOWBOOK_SUPPORT_BACKUP_OWNER=
GLOWBOOK_SUPPORT_CHANNEL=
GLOWBOOK_SUPPORT_FIRST_WEEK_SCHEDULE=
```
