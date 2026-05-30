# Reminders Module

Responsabilidad: read Module para cola operativa de recordatorios.

Interface principal:

- `use-cases/get-reminder-queue.ts`
- `view-models.ts`

Autoridad final:

- Actualmente compone datos de citas, empleados, Salon y plantillas.
- No envia mensajes reales todavia; prepara una vista operativa.

Adapters externos:

- No tiene data Adapter propio mientras no posea persistencia o integracion
  externa propia.
- Consume Adapters de otros Modules mediante su use-case.

Tests que protegen el Module:

- `use-cases/get-reminder-queue.test.ts`

No debe vivir aqui:

- render generico de plantillas, que pertenece a notifications.
- reglas de agenda, que pertenecen a appointments.
- envio real de mensajes sin crear use-cases separados.

Cuando exista envio real, crear Modules dedicados:

- `send-reminder`
- `record-reminder-attempt`
- `retry-reminder`
