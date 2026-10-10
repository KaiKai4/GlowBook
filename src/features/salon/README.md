# Salon Module

Responsabilidad: identidad y configuración del salón: datos generales, apariencia, horario, configuración de agenda, métodos de pago, actividad reciente y shell del panel.

Interface principal (`index.ts`, con `server-only`):

- Lectura: `getSalonSettings`, `getSalonIdentity`, `getSalonBusinessHours`, `getSalonSchedulingConfig`, `getSalonPaymentMethods`, `getSalonActivity`.
- Shell del panel: `getDashboardShell` y `getOwnerPlanLimitWarnings` (`use-cases/get-dashboard-shell.ts`).
- Escritura: `updateSalonInfo`, `updateSalonTheme`, `updateSalonBackground`, `updateBusinessHours`, `updateSalonPaymentMethods`.
- Entrada: `parseBusinessHoursJson` (`use-cases/business-hours-input.ts`) y `assertSalonPaymentMethodEnabled`.

Dominio puro: `domain/activity-messages.ts` (textos de la actividad reciente).

Tablas que usa:

- `salons`, `salon_business_hours`, `salon_activity_log` (`data/salon-settings.repo.ts`, `data/salon-appearance.repo.ts`, `data/salon-business-hours.repo.ts`, `data/activity-log.repo.ts`).

Reglas importantes:

- Permisos de lectura de agenda y reportes en el shell: `appointments.view` y `reports.view`.
- La actividad reciente se lee con el permiso `salon.manage` (comentario en `data/activity-log.repo.ts`).
- La configuración de métodos de pago se valida contra `src/features/payments`.

Tests: `use-cases/*.test.ts` (horario, identidad, métodos de pago, shell, actividad), `data/*.repo.test.ts`, `domain/activity-messages.test.ts`.
