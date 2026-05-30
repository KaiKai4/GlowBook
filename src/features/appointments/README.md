# Appointments Module

Responsabilidad: agenda, disponibilidad, ciclo de vida y creacion atomica de
citas del Salon.

Interface principal:

- `use-cases/create-appointment.ts`
- `use-cases/get-calendar-view.ts`
- `use-cases/get-appointment-detail.ts`
- `use-cases/appointment-availability.ts`
- `use-cases/cancel-appointment.ts`
- `use-cases/confirm-appointment.ts`
- `use-cases/complete-appointment.ts`

Autoridad final:

- SQL/RPC/constraints protegen integridad final.
- `appointment_items` es la fuente de verdad de horario, colaborador, servicio,
  precio y orden.
- `domain/*` hace prevalidacion y calculos puros para UX y testabilidad.

Adapters externos:

- `data/appointments.repo.ts` para lecturas.
- `data/appointment-commands.repo.ts` para comandos, RPC y query shape.

Tests que protegen el Module:

- `domain/*.test.ts`
- `use-cases/*appointment*.test.ts`
- `use-cases/create-appointment.rpc.test.ts` cuando hay variables Supabase.

No debe vivir aqui:

- UI route-local de Next.
- reglas de clientes, servicios o colaboradores salvo como input de agenda.
- acceso directo a Supabase desde `src/app`.
