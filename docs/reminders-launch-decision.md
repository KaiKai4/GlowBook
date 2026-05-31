# Decision De Lanzamiento: Recordatorios

Fecha: 2026-05-30

Decision actual: `features/reminders` queda como read Module operativo para el
MVP de 5+ salones. No se activa envio real sin elegir proveedor y canal.

## Motivo

El Module actual construye una cola/lista operativa de recordatorios. Eso es
correcto para lectura y supervision, pero enviar email/SMS/WhatsApp introduce
side effects, reintentos, costos, limites de proveedor, plantillas y fallos
externos.

Implementar envio real sin proveedor decidido crearia una abstraccion falsa y
deuda tecnica.

## Si El Producto Promete Envio Real

Antes de lanzamiento se debe crear:

- `src/features/reminders/use-cases/send-reminder.ts`
- `src/features/reminders/use-cases/record-reminder-attempt.ts`
- `src/features/reminders/use-cases/retry-reminder.ts`
- `src/features/reminders/data/reminder-log.repo.ts`
- Adapter del proveedor elegido
- tests con proveedor mockeado
- documentacion de variables del proveedor

Debe usarse `appointment_reminder_log` para registrar intentos y errores.
