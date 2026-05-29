# GlowBook Context

Este archivo define el vocabulario estable del dominio. Su objetivo es que las auditorias, refactors y nuevas funciones usen las mismas palabras y no mezclen conceptos que parecen iguales pero no lo son.

## Producto

**GlowBook** es un SaaS multi-tenant para gestionar salones de belleza. Cada salon es un tenant aislado: sus clientes, colaboradores, servicios, citas, roles, plantillas y reportes pertenecen solo a ese salon.

El sistema tiene tres niveles:

- **Plataforma**: la administracion global del SaaS. Usa el area `/admin` y puede ver, invitar, suspender o eliminar salones completos.
- **Salon**: el tenant operativo. Tiene su propia configuracion, horarios, catalogo, clientes, colaboradores, citas y roles.
- **Equipo del salon**: usuarios internos del salon con permisos dinamicos segun su rol.

## Personas Y Acceso

**Superadmin de plataforma** es una cuenta registrada en `platform_admins`. No administra un salon especifico; administra el SaaS completo. Puede ejecutar operaciones cross-tenant solo desde servidor y con `service_role`.

**Owner** es el dueno de un salon. Es un `profile` con `is_owner = true`. Tiene todos los permisos del salon y no debe depender de nombres de rol hardcodeados.

**Profile** es la identidad que inicia sesion. Enlaza `auth.users` con un salon, un rol y el estado de acceso. No representa necesariamente a alguien que atiende clientes.

**Colaborador** es el recurso operativo que presta servicios. Vive en `employees`. Puede tener o no `profile_id`. Un colaborador con `profile_id` puede iniciar sesion; un colaborador sin `profile_id` puede seguir existiendo como recurso para citas, historial o trazabilidad.

**Cliente** es la persona atendida por el salon. Vive en `customers`. Puede estar activo o archivado. Su historial de citas debe conservarse.

**Cuenta Auth** es la cuenta real en Supabase Auth. No es equivalente a `profile` ni a `employee`. Al cambiar el correo de un colaborador con acceso, se revoca la cuenta anterior y se genera una nueva invitacion.

## Autorizacion

**Permiso** es una accion que el sistema sabe aplicar, por ejemplo `appointments.manage` o `customers.manage`. El catalogo vive en la base de datos y en `src/features/access/domain/permissions.ts`.

**Rol** es una agrupacion de permisos dentro de un salon. Los roles pertenecen al salon y pueden cambiar sin tocar codigo.

**RBAC dinamico** significa que la aplicacion pregunta "tiene este permiso?" y no "el rol se llama owner/recepcionista?". El owner tiene cortocircuito por `is_owner`.

**RLS** es la frontera principal de seguridad de datos. Cada tabla de negocio debe aislar por `salon_id = public.salon_id()` y aplicar permisos para escritura cuando corresponda.

## Salon Y Configuracion

**Salon** es la raiz del tenant. Vive en `salons` y contiene datos del negocio, estado activo, zona horaria, colores y reglas de agenda.

**Funcion del salon** es un modulo operativo que la Plataforma puede habilitar o deshabilitar para un salon, por ejemplo `plantillas`, `roles`, `reports` o `appointments`. La fuente de verdad vive en `salons.disabled_features`; la logica TypeScript vive en `src/features/salon/domain/salon-features.ts`.

**Horario del salon** vive en `salon_business_hours`. Define cuando el negocio atiende. Si no hay configuracion, la logica de disponibilidad usa horario por defecto.

**Horario laboral del colaborador** vive en `work_schedules`. Define cuando un colaborador puede atender. Si el colaborador no tiene horarios configurados, se usa el horario del salon como fallback.

**Configuracion de agenda** incluye anticipacion minima, duracion minima, zona horaria y si se permiten reservas fuera del horario del salon. El owner de configuracion y persistencia es `features/salon`; `features/appointments` la consume para calcular disponibilidad y validar agenda.

## Catalogo Operativo

**Categoria de servicio** agrupa servicios dentro de un salon.

**Servicio** define nombre, duracion, precio, categoria y estado activo. La duracion del servicio es la unidad que mueve el cursor al crear citas itemizadas.

**Asignacion de colaborador** indica que un colaborador puede atender una categoria y realizar servicios especificos. El owner de la regla es `features/employees`, porque la asignacion describe capacidades del colaborador. `features/services` define el catalogo y `features/appointments` consume la asignacion al calcular disponibilidad.

## Citas

**Cita** es la cabecera en `appointments`. Guarda cliente, estado, notas, creador y campos derivados como inicio, fin y total.

**Item de cita** es la verdad de la agenda en `appointment_items`. Cada item tiene un servicio, un colaborador, un inicio, un fin, duracion, precio y orden.

**Cita itemizada** significa que una cita siempre esta formada por uno o mas items. No existe un modelo legacy paralelo de "cita con muchos servicios" fuera de `appointment_items`.

**Cursor secuencial** es la regla de agenda: al ordenar servicios, el primer item empieza en la hora elegida y cada item siguiente empieza cuando termina el anterior.

**Disponibilidad** combina horario del salon, horario del colaborador, servicios asignados y ocupacion real del calendario.

**Bloqueo de calendario** usa `blocks_calendar`. Solo las citas `scheduled` y `confirmed` deben bloquear agenda. Canceladas, no show o completadas no deben bloquear nuevos turnos.

## Ciclo De Vida

**Archivado** significa `is_active = false`. No borra fisicamente el registro, conserva historial y saca al registro de flujos activos como selectores, nueva cita y recordatorios operativos.

**Reactivacion** significa volver a `is_active = true` para que el cliente o colaborador reaparezca en flujos activos sin perder su historial.

**Eliminacion completa de salon** es una excepcion al archivado. La plataforma la usa cuando un salon deja el SaaS y quiere borrar todos sus datos. Debe ejecutarse como operacion protegida y transaccional en base de datos para los datos publicos del tenant.

## Notificaciones

**Plantilla** es el texto configurable por salon para mensajes operativos, como recordatorio y cancelacion. Vive en `notification_templates`.

**Placeholder** es una variable dentro de una plantilla, por ejemplo `{cliente}`, `{fecha}`, `{hora}`, `{servicios}`, `{colaboradores}` o `{salon}`.

**Recordatorio operativo** es un mensaje enviado desde el apartado de recordatorios. El owner del flujo operativo es `features/reminders`; `features/notifications` solo owns plantillas, placeholders y renderizado de mensajes. Debe usar plantillas activas y respetar permisos de `reminders.send`.

## Invitaciones

**Invitacion de salon** vive en `salon_invitations`. Es la unica forma autorizada de crear un salon nuevo. El email de la invitacion debe coincidir con el email autenticado.

**Invitacion de colaborador** vive en `employee_invitations`. Permite que un colaborador acepte acceso al sistema. Al cambiar correo o resetear acceso, las invitaciones pendientes anteriores se invalidan y se genera un token nuevo.

## Reglas Que No Deben Romperse

- Un salon nunca debe ver datos de otro salon.
- Los permisos se revisan por permiso, no por nombre de rol.
- `appointment_items` es la fuente de verdad de la agenda.
- El colaborador archivado o cliente archivado conserva historial.
- Un registro archivado no debe aparecer en nueva cita ni selectores activos.
- Al reactivar, el registro vuelve a flujos activos.
- La eliminacion completa de salon no es lo mismo que archivar colaborador o cliente.
- `service_role` nunca debe usarse en el navegador.
- Una funcion del salon deshabilitada por Plataforma no debe aparecer en navegacion ni poder ejecutarse saltando por URL o Server Action.
