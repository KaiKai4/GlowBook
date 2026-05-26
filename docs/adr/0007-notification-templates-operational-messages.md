# ADR 0007: Plantillas Para Mensajes Operativos

## Estado

Aceptada.

## Contexto

Los salones necesitan personalizar mensajes de recordatorio y cancelacion. Hardcodear los textos en botones o pantallas impide que cada salon hable con su propio tono.

## Decision

Los mensajes operativos usan plantillas por salon en `notification_templates`.

El dominio de plantillas define eventos soportados, placeholders permitidos y un render seguro con fallback por defecto cuando no exista plantilla activa.

Los flujos de recordatorios y cancelacion deben usar la misma logica de plantillas.

## Consecuencias

El texto queda configurable sin tocar codigo.

Los placeholders deben documentarse y mantenerse estables para no romper plantillas existentes.

Los eventos nuevos de notificacion deben agregarse al catalogo, a las validaciones y a la UI de plantillas.
