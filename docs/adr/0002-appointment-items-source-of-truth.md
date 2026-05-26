# ADR 0002: Appointment Items Como Fuente De Verdad

## Estado

Aceptada.

## Contexto

Una cita puede incluir varios servicios y cada servicio puede tener un colaborador distinto. Si existieran dos modelos al mismo tiempo, por ejemplo cabecera con servicios directos y ademas items, la disponibilidad, reportes, cancelaciones y totales tendrian ramas duplicadas.

## Decision

La agenda se modela con `appointments` como cabecera y `appointment_items` como fuente de verdad.

Cada item contiene servicio, colaborador, rango horario, precio, duracion y orden. La cabecera conserva campos derivados como `start_time`, `end_time` y `total_price`, recalculados por trigger.

La creacion de citas usa un cursor secuencial: cada servicio empieza cuando termina el anterior segun el orden elegido en el wizard.

## Consecuencias

La disponibilidad, los reportes y las cancelaciones pueden mirar una sola estructura.

La restriccion de no doble-booking se puede aplicar directamente sobre `appointment_items`.

Las pantallas deben tratar incluso una cita de un solo servicio como una cita con un item.
