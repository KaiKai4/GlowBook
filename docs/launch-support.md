# Launch Support Owner

Fecha: 2026-05-31

## Owner Inicial

Owner de soporte para la semana de lanzamiento:

```text
KaiKaira / project owner
```

Este owner puede cambiar antes de produccion, pero no debe quedar vacio.

## Owner Suplente

Para piloto y crecimiento controlado, el owner inicial puede cubrir el soporte.
Para lanzamiento amplio, confirmar un owner suplente antes de abrir el soporte a muchos salones.

Variable operativa:

```text
GLOWBOOK_SUPPORT_BACKUP_OWNER=
```

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

## Canales De Soporte

Canal minimo interno:

```text
Vercel + Supabase + Platform Audit + Feedback
```

Para lanzamiento amplio, confirmar un canal externo para salones:

```text
GLOWBOOK_SUPPORT_CHANNEL=
```

Ejemplos validos: email de soporte, WhatsApp Business, formulario dedicado o
mesa de ayuda. El canal debe existir antes de publicar campanas amplias.

## Guardia Primera Semana

La guardia minima debe cubrir los primeros 7 dias despues del lanzamiento.

Variable operativa:

```text
GLOWBOOK_SUPPORT_FIRST_WEEK_SCHEDULE=
```

No activar `GLOWBOOK_SUPPORT_REQUIRE_CONFIRMED_CHANNELS=true` hasta que owner,
suplente, canal y horario esten definidos.

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
- revisar `docs/runbooks/incident.md`;
- definir horario de respuesta durante los primeros 7 dias;
- registrar postmortem para incidentes SEV1/SEV2.

Revisión manual: confirma cada punto de la sección anterior con el responsable de soporte antes de abrir el soporte a muchos salones.

## Decision Conservadora 2026-06-01

Para piloto y crecimiento controlado, el soporte inicial queda cubierto por:

- KaiKaira / project owner;
- Vercel dashboard;
- Supabase dashboard;
- Platform Audit;
- Feedback interno de la app.

Antes de campanas publicas masivas se debe confirmar un canal externo para
salones, owner suplente y horario de guardia de primera semana.
