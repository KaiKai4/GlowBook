# Reminders Module

Responsabilidad: cola operativa de recordatorios de citas (qué citas recordar, estado de cada fila y confirmación).

Interface principal (`index.ts`):

- `getReminderQueue` (`use-cases/get-reminder-queue.ts`): compone citas, empleados, salón y plantilla.
- `recordManualReminder` (`use-cases/record-manual-reminder.ts`): registra un envío manual.
- `parseManualReminderInput` / `parseConfirmReminderInput` (`use-cases/reminder-input.ts`): validación de entrada.
- Tipos de `view-models.ts`.

Dominio puro (`domain/`, sin acceso a Supabase ni a React):

- `local-date.ts`: fechas locales del salón (`localDateStr`, `isSameLocalDay`).
- `reminder-rules.ts`: periodos, `REMINDER_WINDOW_MS` (ventana de 48 h), pendientes, filtros y estado de fila.
- `reminders-table-rows.ts`: filas de tabla con marcas de operación en curso.

Componentes cliente de `src/app/(dashboard)/recordatorios/` importan del `domain/` directamente, porque
el `index.ts` arrastra casos de uso marcados con `server-only`. Solo importan tipos desde `index.ts`.

Autoridad final:

- Actualmente compone datos de citas, empleados, Salon y plantillas.
- No envia mensajes reales todavia; prepara una vista operativa.

Adapters externos:

- `data/reminder-log.repo.ts`: persistencia del registro de recordatorios enviados.
- Consume Adapters de otros Modules mediante su use-case o `index.ts`.

Tests que protegen el Module:

- `use-cases/get-reminder-queue.test.ts`, `use-cases/record-manual-reminder.test.ts`, `use-cases/reminder-input.test.ts`.
- `domain/reminder-rules.test.ts`, `domain/reminders-table-rows.test.ts`, `domain/local-date.test.ts`.

No debe vivir aqui:

- render generico de plantillas, que pertenece a notifications.
- reglas de agenda, que pertenecen a appointments.
- envio real de mensajes sin crear use-cases separados.

Cuando exista envio real, crear Modules dedicados:

- `send-reminder`
- `record-reminder-attempt`
- `retry-reminder`
