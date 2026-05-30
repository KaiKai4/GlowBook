# Testing Y Checks Supabase

## Suite Principal

La suite normal se ejecuta con:

```text
npm run test
```

Tambien deben correr antes de merge o deploy:

```text
npm run architecture:check
npm run type-check
npm run lint
npm run build
```

## Tests RPC/RLS Con Supabase Real

Algunos contratos viven en SQL/RLS/RPC y no pueden probarse completamente con
unit tests. El test `src/features/appointments/use-cases/create-appointment.rpc.test.ts`
se ejecuta cuando existe conexion Supabase de integracion:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Si tambien existen estas variables, se usa ese usuario de prueba:

```text
SUPABASE_TEST_EMAIL
SUPABASE_TEST_PASSWORD
```

Si `SUPABASE_TEST_EMAIL` y `SUPABASE_TEST_PASSWORD` no existen, el test crea un
Salon owner temporal con `service_role`, configura horarios y datos operativos
minimos, ejecuta el contrato RPC y limpia los datos al terminar.

Si faltan URL, anon key o service role, Vitest marca esos tests como skipped.
Ese skip es intencional: evita que la suite local falle cuando no hay proyecto
Supabase de integracion conectado.

## Contratos Criticos A Validar En Supabase

- `create_appointment(payload jsonb)` rechaza payloads manipulados.
- `appointment_items` bloquea doble reserva por colaborador.
- triggers recalculan cabecera de `appointments`.
- RLS aisla datos por `salon_id`.
- operaciones Platform-only requieren `service_role` y verificacion de Platform admin.
- borrado completo de Salon usa RPC transaccional y cleanup Auth separado.

## Checklist Para Cambios De Base De Datos

1. Identificar el Module TypeScript owner en `docs/database-contracts.md`.
2. Revisar ADR relacionado.
3. Definir si SQL o TypeScript es autoridad final.
4. Crear o actualizar migracion.
5. Regenerar `src/types/database.types.ts` con `npm run db:types`.
6. Agregar unit tests para reglas TypeScript.
7. Agregar o ejecutar checks RPC/RLS si seguridad o integridad cambia.
8. Correr `npm run architecture:health` para revisar deuda visible.

## Fixtures De Integracion

Los fixtures compartidos viven en:

```text
src/test/supabase-integration-fixtures.ts
```

Se usan para crear usuarios temporales de Salon owner y Platform admin en tests
RPC/E2E sin guardar credenciales en el repo.
