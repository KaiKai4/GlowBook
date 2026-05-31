# Runbook: Database Restore

## Objetivo

Probar y ejecutar restore de Supabase sin improvisar durante un incidente.

## Politica

- Production debe tener backups habilitados en Supabase.
- Todo restore debe probarse primero en staging o proyecto temporal cuando sea posible.
- Antes de una migracion destructiva debe existir backup reciente.

## Restore De Prueba

1. Crear proyecto temporal o usar staging aislado.
2. Restaurar backup desde Supabase dashboard o CLI segun plan contratado.
3. Configurar variables contra el entorno restaurado.
4. Ejecutar:

```text
npm run db:types
npm run test
npm run test:e2e:staging
```

5. Revisar que:
   - salones cargan;
   - citas conservan `appointment_items`;
   - owners pueden iniciar sesion;
   - Platform overview carga;
   - audit log existe.

## Restore De Production

1. Declarar incidente.
2. Pausar deploys y operaciones destructivas.
3. Identificar hora objetivo del restore.
4. Confirmar impacto con negocio/soporte.
5. Ejecutar restore segun Supabase.
6. Rotar secretos si el incidente fue de seguridad.
7. Ejecutar smoke minimo:
   - login;
   - dashboard;
   - agenda;
   - crear cita;
   - Platform admin.

## Evidencia

Guardar fecha, hora, backup usado, responsable y resultado en el registro de
operacion del equipo.
