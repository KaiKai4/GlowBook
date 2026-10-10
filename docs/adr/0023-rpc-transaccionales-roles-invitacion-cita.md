# ADR 0023: RPC transaccionales para roles, invitación con plan y cita con cliente nuevo

- **Estado**: Aceptada
- **Fecha**: 2026-10-10

## Contexto

Varios flujos de la aplicación escribían en BD con más de una llamada independiente. Si una de ellas fallaba, quedaba un estado parcial que la interfaz no podía deshacer:

- **Roles**: `createRole` insertaba el rol y `setRolePermissions` borraba e insertaba los permisos en llamadas separadas. Un fallo a mitad dejaba un rol sin permisos o con permisos a medias.
- **Invitaciones de salón**: `invite_salon(p_email)` creaba la invitación y, después, el repositorio actualizaba `salon_invitations.plan_id` con el cliente admin. Un fallo en ese segundo paso dejaba una invitación sin el plan elegido.
- **Citas con cliente nuevo**: el asistente creaba primero el cliente y luego llamaba a `create_appointment`. Si la cita fallaba (solape, validación, red), el cliente quedaba huérfano.
- **Colaboradores**: al archivar o eliminar, la cuenta de Auth se revocaba antes de escribir en BD. Si la escritura fallaba, el colaborador perdía el acceso sin que el registro reflejara el cambio.

Los fallos parciales no son solo un problema de datos: el usuario reintenta sin saber qué quedó hecho, y la idempotencia de las RPC ya cubre el reintento solo cuando la operación es una única llamada.

## Decisión

1. **Una RPC por operación compuesta.** Si varias escrituras deben ser atómicas, viven en una sola función de Postgres. Una llamada RPC es una transacción: si cualquier paso falla, no queda nada escrito.
   - `create_role_with_permissions(p_name, p_permission_keys)` y `replace_role_permissions(p_role_id, p_permission_keys)` (migración `20240101000070`).
   - `invite_salon(p_email, p_plan_id)` (migración `20240101000071`), que guarda el plan en el mismo `insert`.
   - `create_appointment(payload)` acepta `new_customer` como alternativa a `customer_id` (migración `20240101000072`), con el helper interno `resolve_new_customer`.
2. **Modo de seguridad según el caso.**
   - `security invoker` cuando la RLS ya expresa la regla: las RPC de roles dependen de las políticas de `roles` y `role_permissions` y comprueban `roles.manage` antes de escribir, para devolver un error claro en lugar de una violación de RLS.
   - `security definer` solo donde ya lo era antes del cambio (`invite_salon`, `create_appointment`), manteniendo sus comprobaciones explícitas (`is_platform_admin()`, `has_permission(...)`, filtro por `salon_id`).
   - Los grants siguen el mínimo: `revoke all` y `grant execute` solo a `authenticated`. `resolve_new_customer` no tiene ningún grant de cliente.
3. **Códigos SQLSTATE con significado fijo.** Las RPC devuelven errores con código estable y mensaje controlado:
   - `42501`: falta el permiso (`roles.manage`, `customers.manage`, `appointments.manage`).
   - `22023`: entrada inválida (permiso inexistente, plan inexistente o archivado, nombre o apellido vacíos o demasiado largos, cita con cliente existente y nuevo a la vez o ninguno).
   - `P0002`: el rol no existe o no pertenece al salón del claim.
   - `P0001`: el teléfono del cliente nuevo ya pertenece a un cliente archivado; debe restaurarse desde Clientes para conservar su historial.
   La capa de aplicación traduce estos códigos a mensajes públicos según ADR 0018. Nunca se muestra el mensaje crudo de Postgres.
4. **Regla general.** Lo que debe ser atómico vive en una RPC, no en dos llamadas desde el repositorio ni en la acción de servidor. Las acciones y los casos de uso solo orquestan.
5. **Auth siempre después de la BD.** Cuando una operación toca la cuenta de Auth además de la BD (colaboradores, salones), primero se escribe la BD, de forma atómica, y después se modifica Auth. Si Auth falla, la operación devuelve un aviso explícito al usuario en lugar de dar por completa la revocación. Así el registro de BD nunca queda en un estado que no coincide con lo que el usuario ve.

## Consecuencias

- Los tres flujos quedan atómicos sin lógica de compensación en la aplicación. Una cita con cliente nuevo que falla no deja cliente huérfano.
- La lógica de negocio queda en SQL y se prueba con pgTAP: `supabase/tests/11_role_permission_rpcs.sql`, `12_invitations.sql` y `13_create_appointment_new_customer.sql`.
- La idempotencia de `create_appointment` cubre el payload completo, incluido `new_customer`: un reenvío devuelve la misma cita y no crea un segundo cliente.
- El tipo de retorno de `create_appointment` se mantiene (`uuid`, id de la cita) para no romper consumidores. El id del cliente nuevo no se devuelve; se consulta a partir de la cita.
- Cada RPC nueva es una superficie pública: su firma, sus grants y sus códigos de error forman contrato y se documentan en `docs/database-contracts.md`. Cambiarlos exige una migración nueva.
- Auth sigue fuera de la transacción de BD: un fallo de Auth no revierte la BD, por eso el aviso al usuario es obligatorio.
- Coste: las RPC concentran más lógica en Postgres. Los cambios de reglas de negocio deben revisarse también en SQL y en las pruebas pgTAP.
