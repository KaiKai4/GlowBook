# E2E Para Flujos Criticos

Fuente: Fase 24 de `docs/architecture-audit-phases-2026-05-30.md`.

## Estado

Implementacion inicial creada con Playwright.

Motivo:

- funciona bien con Next.js;
- permite flujos reales de navegador;
- soporta trazas, screenshots y fixtures;
- es suficiente para smoke tests de UI + Server Actions + Supabase.

## Flujos Minimos A Cubrir

1. Login de usuario de Salon activo.
2. Dashboard de Salon activo carga correctamente.
3. Crear cita valida.
4. Confirmar, cancelar y completar cita.
5. Archivar y reactivar cliente.
6. Invitar colaborador.
7. Platform admin ve salones.
8. Feature deshabilitada no aparece en navegacion y no es accesible por ruta.

## Requisitos Antes De Crear Tests

- definir proyecto Supabase de integracion o seed local;
- crear usuarios de prueba separados de datos reales;
- decidir como resetear datos entre tests;
- instalar dependencia E2E;
- documentar comando de ejecucion.

## Comandos Propuestos

Instalacion aplicada:

```text
npm install -D @playwright/test
npx playwright install
```

Scripts:

```text
npm run test:e2e
npm run test:e2e:ui
```

## Variables Para Flujos Autenticados

Los tests publicos siempre corren:

- login renderiza la Interface publica;
- rutas protegidas redirigen anonimos a `/login`.

Los tests autenticados pueden usar credenciales de prueba:

```text
E2E_SALON_OWNER_EMAIL
E2E_SALON_OWNER_PASSWORD
E2E_PLATFORM_ADMIN_EMAIL
E2E_PLATFORM_ADMIN_PASSWORD
```

Tambien se aceptan `SUPABASE_TEST_EMAIL` y `SUPABASE_TEST_PASSWORD` para el
smoke de owner de Salon.

Si no existen credenciales pero si existen `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, la suite crea
fixtures temporales para Salon owner y Platform admin con:

```text
src/test/supabase-integration-fixtures.ts
```

## Decision Actual

Los flujos autenticados no dependen de datos manuales inestables cuando existe
`SUPABASE_SERVICE_ROLE_KEY`: la suite crea Salon owner, Platform admin, cliente,
colaborador, servicio, horarios e invitaciones temporales y luego limpia esos
datos. Si solo existen credenciales manuales, los tests usan esas credenciales y
omiten los flujos que requieren fixture temporal.

Cobertura actual:

- login publico renderiza;
- ruta protegida redirige anonimos a `/login`;
- dashboard de Salon carga con Modules visibles;
- alta de cita valida desde navegador;
- confirmar, completar y cancelar citas desde detalle;
- archivar y reactivar cliente;
- generar enlace de invitacion para colaborador;
- Platform admin ve salones;
- feature deshabilitada no aparece en navegacion y `/appointments` no es accesible;
- logout vuelve a login.

Estado verificado:

```text
npm run test:e2e
11 passed
```

Los flujos autenticados corren con fixtures temporales cuando hay service role.
