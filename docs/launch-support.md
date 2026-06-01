# Launch Support Owner

Fecha: 2026-05-31

## Owner Inicial

Owner de soporte para la semana de lanzamiento:

```text
KaiKaira / project owner
```

Este owner puede cambiar antes de produccion, pero no debe quedar vacio.

## Responsabilidades

- Revisar logs de hosting y Supabase durante la primera semana.
- Revisar feedback recibido desde la UI de soporte.
- Confirmar antes de suspender, reactivar o borrar un Salon.
- Coordinar rollback o restore si aparece un incidente de datos.
- Registrar decisiones de operacion sensibles en `platform_audit_log` o en el
  registro operativo del equipo.

## Ventana Inicial

```text
Primeros 7 dias despues del lanzamiento.
```

## Canales Minimos

- Supabase Dashboard para Auth, Database, Logs y Advisors.
- Hosting dashboard para deploys, errores y logs.
- UI Platform de GlowBook para Salons, Audit y Feedback.

## Criterio De Cierre

- Hay una persona responsable.
- La persona conoce runbooks de deploy, rollback, restore y Platform operations.
- El owner revisa logs despues de E2E/smoke y durante la primera semana de
  produccion.

## Lanzamiento Amplio

Antes de abrir a muchos salones:

- confirmar owner principal y owner suplente;
- confirmar canal de soporte externo para salones;
- confirmar acceso a Vercel, Supabase, Platform Audit y Feedback;
- revisar `docs/runbooks/incidents.md`;
- definir horario de respuesta durante los primeros 7 dias;
- registrar postmortem para incidentes SEV1/SEV2.
