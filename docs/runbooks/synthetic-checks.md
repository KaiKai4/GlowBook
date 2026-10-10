# Runbook: Checks Sinteticos

## Objetivo

Detectar pronto que el login de producción deja de responder bien
(estado, cabeceras de seguridad, `x-request-id`, latencia), sin esperar a que
un salón lo reporte.

## Que Comprueba

El workflow `.github/workflows/synthetic.yml` corre **cada hora** (minuto 23)
y también manualmente (`workflow_dispatch`). Comprueba solo producción:

| Target | Secreto de URL base | Notas |
|---|---|---|
| `production` | `SYNTHETIC_BASE_URL` | Solo lectura. |

Cada ejecución hace un único `GET /login` (sin seguir redirecciones) y falla si:

- el estado HTTP no es `200`;
- falta alguna cabecera de seguridad o está vacía: `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Content-Security-Policy`, `Strict-Transport-Security`;
- falta `x-request-id` o no tiene formato UUID (si falta, no hay forma de
  hacer triage en logs);
- la respuesta tarda `3000 ms` o más (timeout duro de `10 s`).

El check no autentica, no escribe datos y no imprime la URL base ni valores de
cabeceras. Solo nombres de cabecera y resultados.

## Secretos Requeridos

El job **falla con mensaje explícito** si falta cualquiera de estos secretos
(no se salta en silencio):

- `SYNTHETIC_BASE_URL` (producción).

`ALERT_WEBHOOK_URL` es opcional. Sin él se usan los avisos de GitHub Actions y
los issues de incidentes.

`GITHUB_TOKEN` lo provee Actions; el job necesita `issues: write`.

## Que Pasa Cuando Falla

1. El paso `Run synthetic check` falla y el job queda en rojo.
2. Si hay webhook, `scripts/ops/synthetic-alert-cli.mjs` envía un `POST` JSON a
   `ALERT_WEBHOOK_URL`. El payload contiene: `target`, `checkPath`, `status`,
   `elapsedMs`, `failures`, `runUrl`, `commit` (7 caracteres), `occurredAt`.
   No contiene URL base, cabeceras ni tokens.
3. Se crea un issue `[synthetic][<target>] check de disponibilidad fallando`
   con la etiqueta `synthetic-failure`. Si ya hay uno abierto, se comenta en
   lugar de duplicarlo.
4. Cuando el check vuelve a pasar, se comenta la recuperación y se cierra el
   issue. No se envía webhook de recuperación.

## Como Responder A Una Alerta

1. **Abrir el enlace de ejecución** del issue y leer los `failures`.
2. **Confirmar si es real**: repetir el check manualmente con
   `workflow_dispatch` sobre el mismo target. Si pasa, anotar la ventana y
   vigilar la siguiente hora.
3. **Clasificar**:
   - Estado `5xx` o sin respuesta: tratar como SEV2 (ver `incident.md`).
     Revisar Vercel Logs de la ventana y el estado de Supabase.
   - Cabecera faltante o `x-request-id` ausente: revisar el último deploy y
     `next.config` / `middleware`. Si empezó con un deploy, valorar rollback
     de frontend con `vercel rollback`.
   - Latencia alta sin errores: revisar duración de funciones en Vercel y
     advisors/logs de Supabase. Severidad SEV3 si el login responde.
4. **Triage con `x-request-id`**: si el fallo viene de una petición real,
   usar el UUID de la cabecera para buscar la traza en Vercel Logs y en los
   logs de Supabase.
5. **Comunicar**: si hay impacto en salones, seguir `incident.md` (sección
   comunicación). No publicar URLs, tokens ni datos de salones en el issue.
6. **Cerrar**: si la causa fue resuelta, dejar que el siguiente check cierre el
   issue automáticamente o cerrarlo con una nota de causa raíz.

## Falsos Positivos Habituales

- Cold start de Vercel puntual: el check reintenta en la siguiente hora. Si
  ocurren dos fallos seguidos por latencia, investigar.
- Mantenimiento programado de Supabase: anotar la ventana antes de escalar.

## Cambiar Umbrales O Destinos

- El umbral de latencia y las cabeceras requeridas viven en
  `scripts/quality/synthetic-check.mjs`. Cambiarlos requiere PR con tests en
  `scripts/ops/synthetic-check.test.mjs`.
- La decisión de alerta vive en `scripts/ops/synthetic-alert.mjs`.
- Rotar `ALERT_WEBHOOK_URL` si el webhook se expone (ver rotación de
  secretos en `docs/environments.md`).

## Verificacion Local (Sin Red Externa)

El fixture efímero en `.quality/ops-fixture/run-fixture.mjs` levanta un
servidor local con cabeceras correctas e incorrectas y comprueba que
`synthetic-check.mjs` devuelve el exit code esperado. Los tests unitarios se
ejecutan con:

```text
node --test scripts/ops/synthetic-alert.test.mjs scripts/ops/synthetic-check.test.mjs
```

## Estado

Monitor de producción verificado en GitHub Actions, sin dependencia de staging: [ejecución correcta](https://github.com/KaiKai4/GlowBook/actions/runs/38017894068). Sigue activo cada hora; esta evidencia fechada no sustituye revisar el resultado del último ciclo.
