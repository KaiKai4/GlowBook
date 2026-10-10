# ADR 0021: Deploy sin staging remoto obligatorio

- **Estado**: Aceptada
- **Fecha**: 2026-10-09

## Contexto

El propietario solicita retirar staging para reducir credenciales y mantenimiento.
El entorno remoto bloqueaba la publicación por su conexión Postgres. CI ya
reconstruye Supabase local y prueba migraciones, aislamiento, integración y E2E.

## Decisión

- Retirar validate-staging y sus secretos del contrato de release.
- Mantener los siete checks de CI, las aprobaciones de Production, migraciones
  forward-only, build sin dominio, smoke previo, promoción y rollback del frontend.
- Ejecutar los sintéticos solo contra producción. El drift nocturno compara el
  historial de producción en solo lectura usando PRODUCTION_DB_URL.
- Mantener las pruebas de BD y navegador sobre Supabase local. No dirigir fixtures,
  seeds ni E2E a producción como sustitución de staging.
- Desactivar publicaciones Git automáticas, incluidos previews, y retirar
  credenciales de staging de GitHub y Vercel Preview. El propietario gestiona la
  eliminación del proyecto remoto. Los runbooks de staging quedan como herramientas opcionales.
- Reducir .env.local.example a las variables de aplicación y la guarda de producción.
  Los secretos de despliegue se configuran en GitHub y las variables remotas en Vercel.

## Consecuencias

La release ya no requiere una segunda base de datos ni credenciales de fixtures.
Se pierde el ensayo de migraciones y E2E en una infraestructura remota separada;
la validación de datos y comportamiento se realiza en el stack local de CI.
Una migración debe ser compatible con la app anterior y pasar db-reset, pgTAP e
integración antes de aprobar producción. La retirada de staging sustituye esa
parte de ADR 0020; sus demás controles de publicación permanecen vigentes.
