# Runbook: Restore De Base De Datos

Runbook vigente de restore. Fusiona el antiguo `database-restore.md` (política,
pruebas de restore ejecutadas, restore con dataset grande y gate operativo),
que queda archivado en `docs/archive/runbooks-superseded/database-restore.md`.

## Objetivo

Recuperar la base de datos de producción de Supabase tras pérdida o corrupción
de datos, con un procedimiento ensayado y no improvisado. Este runbook es el
procedimiento operativo; el detalle histórico de las pruebas de restore
(2026-05-31 y 2026-06-01) está archivado en `docs/archive/staging-sections.md`.

## Política

- Production debe tener backups habilitados en Supabase.
- Todo restore debe probarse primero en un proyecto temporal cuando sea posible.
- Antes de una migración destructiva debe existir backup reciente.

## Principios

- Antes de restaurar **producción**, congelar deploys y avisar al responsable
  de comunicación (ver `incident.md`).
- Restaurar primero en un **proyecto de restauración separado**, nunca encima
  de producción.
- No cambiar el tráfico hasta que la verificación pase.
- Cada paso deja evidencia: hora UTC, comando, resultado.

## Requisitos Previos

- Backups de Supabase habilitados en producción. Verificar en el dashboard de
  Supabase (Database > Backups) que existe backup diario y, si el plan lo
  incluye, PITR (Point-in-Time Recovery) habilitado.
- Acceso de owner al proyecto Supabase de producción.
- Acceso a Vercel para cambiar variables de entorno y redeploy.
- Confirmar en la documentación de Supabase del plan contratado cómo se
  restaura (a proyecto nuevo, desde dashboard o CLI). Las opciones dependen del
  plan; no asumir una.

## Paso 1: Declarar Y Congelar

1. Abrir incidente con severidad (SEV1 si hay pérdida de datos).
2. Pausar deploys en Vercel y bloquear `release.yml` cuando exista.
3. Registrar: hora de la pérdida (UTC), última hora conocida buena, alcance
   estimado (tablas y salones afectados).

## Paso 2: Elegir Punto De Restauración

- Preferir el backup o punto PITR **inmediatamente anterior** a la pérdida.
- Si la causa es una migración, el punto debe ser anterior a la migración
  (ver `docs/runbooks/database-migrations.md`).
- Anotar el punto elegido en el incidente antes de restaurar.

## Paso 3: Restaurar En Un Proyecto De Restauración

1. Crear o designar un proyecto Supabase de restauración (nunca producción).
2. Restaurar el backup o PITR en ese proyecto según la opción del plan.
3. Esperar a que el proyecto esté sano en el dashboard y sin alertas de
   advisors críticos.
4. Registrar el `project ref` de restauración en el incidente.

## Paso 4: Verificar

Verificación en tres capas. Todas deben pasar antes del corte.

1. **Base de datos (pgTAP)**: ejecutar la suite pgTAP del repositorio
   (`supabase/tests`) contra el proyecto restaurado. Confirmar que la suite
   no reporta fallos de RLS, constraints ni de no-overlap de citas.
2. **Integridad de datos**: comprobar, con consultas de solo lectura, que:
   - las citas conservan sus `appointment_items`;
   - `platform_audit_log` existe y tiene filas del periodo esperado;
   - `salon_invitations` y `platform_admins` no están vacíos si deberían tener datos.
3. **Smoke de aplicación** (sin escribir datos reales):
   - login de un owner de prueba del salón restaurado;
   - carga del dashboard de un salón y de la agenda;
   - carga de `/admin` (Platform overview) con cuenta de plataforma;
   - crear una cita de prueba solo si el entorno restaurado es de prueba.

Si la verificación falla, **no cortar tráfico**. Documentar el fallo y decidir
si se restaura otro punto.

## Paso 5: Corte De Tráfico

`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se incrustan en el
bundle en build. El corte requiere **redeploy**, no solo cambiar la variable.

1. En Vercel (production), cambiar `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y
   `PRODUCTION_SUPABASE_URL` al proyecto restaurado.
2. Redeploy de producción y verificar con el check sintético (`synthetic.yml`,
   `workflow_dispatch` sobre `production`).
3. Confirmar que el bundle público no contiene `SUPABASE_SERVICE_ROLE_KEY`.
4. Comunicar el corte a los salones afectados.
5. Mantener el proyecto dañado sin borrar hasta cerrar el postmortem.

## Paso 6: Post-Corte

- Vigilar errores 5xx, latencia y advisors durante al menos una hora.
- Revisar que las escrituras de las horas posteriores al punto de restauración
  se comunican a los salones (pérdida de datos entre el punto y el corte).
- Rotar secretos si hay sospecha de compromiso (ver `docs/environments.md`).

## Paso 7: Postmortem

Dentro de 5 días hábiles, con esta estructura:

- Resumen y severidad.
- Línea de tiempo en UTC: detección, decisiones, corte, verificación.
- Causa raíz y factores contribuyentes.
- Datos perdidos o recuperados (tablas, rango horario, número de salones).
- Qué funcionó y qué no.
- Acciones con dueño y fecha.

## Ensayo Trimestral

Un restore que no se ensaya no sirve en un incidente. Cada trimestre:

1. Elegir un backup reciente de **producción**, restaurado siempre en el proyecto temporal.
2. Restaurar en un proyecto de restauración temporal.
3. Ejecutar el Paso 4 completo y medir el tiempo total (RTO real).
4. Registrar fecha, persona, tiempo, fallos y acciones en el incidente o en el
   registro de operaciones del equipo.
5. Eliminar el proyecto temporal al terminar, con confirmación explícita del
   owner.

Objetivos a vigilar: RTO medido frente al objetivo acordado y RPO real (cuántos
minutos de datos se perderían en el punto elegido).

## Estado Del Ensayo

**PENDIENTE**: el ensayo real del procedimiento de este runbook en un proyecto
temporal todavía no se ha ejecutado. Debe hacerlo una persona con acceso de owner
a Supabase de producción (solo para leer el backup) y un proyecto de restauración
temporal, en una ventana acordada. Hasta entonces, este runbook está validado solo
en documentación y no debe considerarse probado.

## Pruebas De Restore Históricas

Las evidencias de los ensayos de 2026-05-31 y 2026-06-01, el restore con dataset grande, el registro de ensayos y el gate de readiness se archivaron en `docs/archive/staging-sections.md`. Dependían de un entorno staging y de scripts retirados por [ADR 0021](../adr/0021-deploy-sin-staging-remoto.md) y [ADR 0022](../adr/0022-retiro-tooling-staging-pricing-readiness-stryker.md).
