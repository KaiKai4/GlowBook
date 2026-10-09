# Decision De Lanzamiento: Recordatorios

Fecha: 2026-05-30

Decision actual: `features/reminders` queda como read Module operativo para el
MVP de 5+ salones. No se activa envio real sin elegir proveedor y canal.

Confirmacion 2026-05-31:

La Fase 44 mantiene esta decision. La UI debe comunicar accion manual: abrir
WhatsApp con el mensaje preparado, no prometer envio automatico desde GlowBook.
El boton de recordatorios usa copy de "Abrir recordatorio en WhatsApp".

## Motivo

El Module actual construye una cola/lista operativa de recordatorios. Eso es
correcto para lectura y supervision, pero enviar email/SMS/WhatsApp introduce
side effects, reintentos, costos, limites de proveedor, plantillas y fallos
externos.

Implementar envio real sin proveedor decidido crearia una abstraccion falsa y
deuda tecnica.

## Si El Producto Promete Envio Real

Antes de lanzamiento se debe crear (ninguno de estos ficheros existe hoy):

- `src/features/reminders/use-cases/` con casos de uso de envío, registro de intento y reintento (previstos, sin nombre definido)
- `src/features/reminders/data/` con repositorio del registro de envíos (previsto)
- Adapter del proveedor elegido
- tests con proveedor mockeado
- documentacion de variables del proveedor

Debe usarse `appointment_reminder_log` para registrar intentos y errores.

## Gate Operativo

Ejecutar:

```text
npm run reminders:readiness
```

El gate valida que la decision manual siga vigente y que no exista codigo de
envio automatico en `src/features/reminders`.

Si el producto decide prometer envio automatico, activar:

```text
GLOWBOOK_REMINDERS_AUTOMATIC_CONFIRMED=true
```

Con esa variable, el gate exige los use-cases y Adapter de envio real antes de
permitir cerrar la fase.
