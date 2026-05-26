# ADR 0006: Eliminacion Completa De Salon Por RPC Transaccional

## Estado

Aceptada.

## Contexto

Cuando un salon deja la plataforma, el superadmin necesita eliminar todos sus datos para que no ocupen espacio ni queden registros operativos innecesarios.

Borrar tabla por tabla desde TypeScript es delicado: si un paso falla, pueden quedar datos a medias.

## Decision

La eliminacion de datos publicos del salon se ejecuta en la base de datos mediante la RPC `delete_salon_completely(p_salon_id uuid)`.

La RPC bloquea el salon, elimina los datos del tenant en orden seguro y devuelve los `user_id` de perfiles asociados.

Despues de la RPC, el servidor elimina las cuentas Supabase Auth asociadas usando Admin API. Esto ocurre fuera de la transaccion Postgres porque Auth no pertenece a las tablas publicas del tenant.

## Consecuencias

La parte critica de datos publicos queda concentrada en una operacion transaccional.

Si falla la eliminacion Auth despues de borrar datos publicos, el sistema debe reportarlo claramente para limpieza manual o reintento.

Esta operacion es irreversible y solo debe estar disponible para superadmin de plataforma.
