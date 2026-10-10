# Runbook: Deploy

## Objetivo

Publicar únicamente mediante `.github/workflows/release.yml`, tras CI completo,
pruebas con Supabase local y aprobaciones de producción. Ver ADR 0021.

## Configuración de una sola vez

1. En GitHub, proteger main con PR y los siete checks de GlowBook CI.
2. En el environment Production, exigir revisión y permitir únicamente main.
3. En Vercel, confirmar el proyecto glow-book del equipo kai-book y su rama main.
4. Mantener `git.deploymentEnabled=false` en `vercel.json`. Las publicaciones Git automáticas quedan desactivadas;
   la release usa el CLI para publicar. Desactivar la
   asignación automática de dominios durante la configuración inicial.
5. Guardar los secretos de la tabla siguiente directamente en GitHub. Nunca
   copiarlos a logs, chat, commits, comentarios o artefactos de pruebas.
6. Configurar Production en Vercel con Supabase producción. Preview y staging
   son opcionales; no compartir credenciales administrativas de producción con ellos.

## Secretos del repositorio

El gate comprueba presencia antes de que se apruebe cualquier environment. Los
IDs y URLs también se guardan como secretos por compatibilidad con el workflow.

| Secreto | Uso |
|---|---|
| VERCEL_TOKEN | Token dedicado para el equipo/proyecto, no la sesión OAuth personal. |
| VERCEL_ORG_ID | Equipo Vercel de GlowBook. |
| VERCEL_PROJECT_ID | Proyecto Vercel de GlowBook. |
| PRODUCTION_DB_URL | Conexión Postgres de producción; preferir pooler Session. |
| PRODUCTION_PROJECT_REF | Ref de producción, confirmado antes de aplicar migraciones. |
| PRODUCTION_SUPABASE_URL | URL pública de producción y guarda contra escrituras de tests. |
| SYNTHETIC_BASE_URL | Dominio público de producción. |
| VERCEL_AUTOMATION_BYPASS_SECRET | Opcional; necesario si la protección bloquea las URLs de prueba. |
| ALERT_WEBHOOK_URL | Opcional. Sin webhook se usan los avisos de GitHub Actions. |

Las conexiones directas con db-url no requieren SUPABASE_ACCESS_TOKEN. No
reutilizar un token personal del agente como credencial de CI ni cambiar la
contraseña de una base existente para completar esta tabla.

## Flujo de publicación

Se dispara al terminar GlowBook CI en éxito por push a main, o con
workflow_dispatch y un SHA completo que ya pertenece a main.

| Job | Control |
|---|---|
| gate | Secretos presentes, SHA de main y los siete jobs de CI en success. Rechaza checks parciales. |
| migrations | Aprobación Production, aplicación forward-only y comprobación estricta de pendientes. |
| deploy-staged | Build remoto con variables Production; despliegue sin asignar dominio. |
| smoke-staged | GET /login, estado 200, cabeceras de seguridad y respuesta menor a 3 segundos. |
| discard-staged | Si falla el smoke, eliminar el despliegue de producción sin dominio. |
| promote | Segunda aprobación Production, promoción del mismo build y smoke del dominio público. |
| notify-failure | Registrar fallo en Actions y enviar webhook si se configuró. |

Los builds de release se ejecutan en Vercel para que sus secretos sensibles
permanezcan allí. CI ya verificó las mismas fuentes y su lockfile con build,
E2E y los demás controles. La promoción no reconstruye el artefacto probado.
Los tokens se entregan únicamente a pasos que los necesitan; checkout no
conserva credenciales. No se publican secretos ni estados de sesión.

## Validación de datos

CI aplica las migraciones al stack Supabase local y ejecuta pgTAP, integración
y E2E. No se necesitan STAGING_DB_URL ni claves de fixtures remotos.
El deployment de production con skip-domain usa la base production: solo se
prueba su disponibilidad en lectura antes de asignar el dominio público.
Nunca ejecutar seeds, limpieza ni E2E con fixtures contra producción.

## Fallos y recuperación

- Gate: completar los secretos o corregir CI; nunca continuar con checks rojos.
- Migraciones: la comprobación final debe pasar. Una aplicación parcial se
  corrige con una migración nueva; no se edita el historial aplicado.
- Deploy: el dominio público sigue sirviendo su despliegue anterior.
- Smoke staged: se elimina solo el deployment fallido sin dominio.
- Promote: si ya promovió y falla el smoke público, rollback solo del frontend.
  La BD no se revierte. Confirmar el deployment sano y revisar compatibilidad.
- Webhook configurado: una respuesta fallida deja también el envío en rojo.
  Sin webhook, el workflow fallido conserva las notificaciones de GitHub.

El rollback puede desactivar autoasignación; la publicación siguiente vuelve a
pasar por promote. La prohibición de desplegar main por Git permanece versionada.

## Migraciones expand/contract

Mientras se prepara la nueva versión, el frontend anterior sigue activo. Las
migraciones deben ser compatibles con él. Primero expandir, luego desplegar y,
en una release posterior, retirar lo viejo. Ver
`docs/runbooks/database-migrations.md` y `docs/runbooks/restore.md`.

## Contingencia y criterio de éxito

La vía manual requiere autorización explícita del owner, CI verde y backup reciente. No se usa para saltarse las aprobaciones.

Una release está lista cuando el workflow está verde, migrations y promote
terminan en success, el smoke público pasa y no quedan incidentes sintéticos
abiertos. Revisar login, agenda, plataforma y logs después del deploy. Para
lanzamientos amplios, completar `docs/production-scale-readiness-checklist.md`.
