# ADR 0020: Release validada en staging y publicación explícita

- **Estado**: Aceptada, con partes superadas por ADR 0021
- **Fecha**: 2026-10-09

## Contexto

Vercel podía publicar un push a main mientras CI fallaba y la release quedaba
omitida. El gate aceptaba un subconjunto de checks. Un despliegue de producción
sin dominio se llamaba staging, aunque usaba la base de producción.

La exigencia de staging remoto queda sustituida por [ADR 0021](0021-deploy-sin-staging-remoto.md).

## Decisión

- Desactivar los despliegues Git de main con `vercel.json`. Los previews de
  otras ramas siguen disponibles. Desactivar también la asignación automática
  de dominios del proyecto durante la configuración inicial.
- Exigir los siete jobs de GlowBook CI; una ejecución de Vercel no sustituye CI.
- Antes de migrar producción, exigir historial de staging actualizado y crear
  un preview del mismo SHA. Validar su Supabase público y ejecutar E2E con
  fixtures de staging. Las precondiciones ausentes hacen fallar el gate.
- Después, aplicar las migraciones compatibles en producción, crear un
  despliegue de producción sin dominio, ejecutar smoke y promover con aprobación.
- Construir en Vercel desde el checkout verificado y el lockfile. Los secretos
  sensibles de producción permanecen en Vercel: no dependen de que una descarga
  local los incluya. El código se verifica previamente con el build y E2E de CI.
- Usar las notificaciones de GitHub Actions como canal inicial. El webhook es
  opcional; si está configurado y falla, el envío sigue fallando explícitamente.
- No reutilizar la sesión OAuth personal como token de automatización ni cambiar
  contraseñas de bases existentes para resolver la configuración de CI.

## Consecuencias

La release necesita credenciales dedicadas y claves de fixtures solo de staging.
Una migración nueva debe aplicarse primero en staging: el control de release
verifica su historial en lectura, sin aplicar pendientes a ese entorno.
Un rollback revierte el frontend; las migraciones siguen siendo forward-only.
Los builds remotos sustituyen al build prebuilt de la release para conservar
los secretos de producción en su plataforma. La promoción publica ese mismo
build remoto que pasó el smoke, sin reconstruirlo.

El verificador local acredita el checkout propietario con la etiqueta Docker
`com.supabase.cli.workdir`; la ausencia de temporales de la CLI no acredita
un checkout diferente. Una etiqueta ausente o de otra ruta sigue bloqueando.
