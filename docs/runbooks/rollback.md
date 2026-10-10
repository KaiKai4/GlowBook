# Runbook: Rollback

## Objetivo

Volver a una version estable cuando un deploy rompe flujo critico.

## Clasificacion Rapida

| Caso | Accion |
|---|---|
| Error solo de UI/runtime web | Revertir deploy desde hosting. |
| Error por variable mal configurada | Corregir secret/env y redeploy. |
| Error por migracion compatible hacia atras | Revertir app primero, luego evaluar SQL. |
| Error por migracion destructiva | Pausar operaciones, restaurar segun runbook de restore. |

## Pasos

1. Declarar incidente y congelar deploys.
2. Capturar error principal: ruta, usuario afectado, hora, release.
3. Revertir al deploy anterior estable desde hosting.
4. Si hubo migracion:
   - revisar SQL aplicado;
   - confirmar si es reversible;
   - no ejecutar SQL manual sin backup.
5. Validar con el check sintético (`synthetic.yml`, `workflow_dispatch` sobre producción) y revisar su resultado.

6. En production, probar login y flujo afectado.

## Despues

- Registrar causa.
- Agregar test o guardrail si el fallo era prevenible.
- Actualizar runbook si hubo paso nuevo.
