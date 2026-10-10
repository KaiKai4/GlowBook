# Política De Seguridad: Reporte De Vulnerabilidades

Esta política describe cómo reportar una vulnerabilidad en GlowBook. Los controles de seguridad vigentes (aislamiento, permisos, cabeceras, CSP, rate limit, secretos) y sus procedimientos están en `docs/security.md`.

## Canal De Reporte

- No abras un issue público ni un pull request con los detalles de una vulnerabilidad.
- Repórtala de forma privada a la persona responsable del repositorio (Allan Ordoñez), por el canal acordado con el equipo.
- Incluye:
  - los pasos para reproducirla;
  - el impacto que crees que tiene;
  - la versión afectada (SHA de `main`) y el entorno (local o producción);
  - las evidencias mínimas.
- No incluyas datos reales de salones ni de clientes, ni secretos. Si necesitas demostrar una fuga, describe el tipo de dato sin copiarlo.

## Alcance

- En alcance: el código de este repositorio (`src/`, `supabase/migrations`, `supabase/tests`, `next.config.ts`, `src/proxy.ts`), las políticas RLS y RPC, y la configuración de despliegue versionada (`vercel.json`, workflows de `.github/`).
- Fuera de alcance: los servicios de terceros (Supabase, Vercel, GitHub) salvo que la vulnerabilidad venga de la configuración propia de GlowBook, y los ataques de ingeniería social o contra la infraestructura física.

## Plazos

- Recibirás acuse de recibo y se coordinará la corrección antes de cualquier divulgación.
- Los plazos concretos de acuse, triaje y corrección están pendientes de fijar por la persona responsable del repositorio. Hasta entonces, una vulnerabilidad confirmada en producción se trata como incidente según `docs/runbooks/incident.md`.

## Versiones Soportadas

Solo la rama `main`, desplegada en producción por la release (`docs/runbooks/deploy.md`). Las ramas de trabajo no se consideran versiones soportadas.

## Después De Una Corrección

- La corrección lleva una prueba que falla antes del cambio (regla de `AGENTS.md`, sección 16).
- Si la vulnerabilidad expuso secretos, se rotan antes de cerrar el caso (`docs/environments.md`, sección de rotación).
- Si hay datos de salones expuestos, se evalúa la notificación con la persona responsable.
