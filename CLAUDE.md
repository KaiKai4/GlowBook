@AGENTS.md

# GlowBook — Enterprise SaaS para Salones de Belleza

## Stack
- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** (Postgres + Auth + RLS + Storage)
- **Vercel** (deploy)

## Arquitectura
- `src/app/` — Rutas (App Router). Grupos: `(auth)`, `(dashboard)`, `(platform)`
- `src/features/<dominio>/` — Lógica de negocio por dominio:
  - `domain/` — funciones puras, sin I/O (testeable)
  - `data/*.repo.ts` — repositorio Supabase
  - `use-cases/` — orquestación (valida → aplica reglas → persiste)
  - `schemas.ts` — Zod DTOs
- `src/lib/` — `supabase/{server,client,admin}.ts`, `auth/`, `utils/`, `result.ts`
- `src/components/` — Design system (`ui/`, `layout/`)
- `supabase/migrations/` — SQL versionado

## Reglas de dependencias (Clean Architecture)
`app/` → `use-cases/` → `domain/` + `data/`  
El `domain/` no importa Next, Supabase ni React.

## Multi-tenancy
RLS de Postgres aísla los datos por salón.  
`auth.salon_id()` — helper SQL que lee el claim `salon_id` del JWT (inyectado por el Auth Hook).  
`auth.has_permission(key)` — comprueba rol + permisos en tiempo real (tablas, no JWT).

## RBAC
- **Permisos** = catálogo global fijo en DB y en `src/features/access/domain/permissions.ts`
- **Roles** = definidos por salón; el owner asigna permisos desde `/roles`
- La autorización pregunta `has_permission('x')`, nunca por nombre de rol
- `is_owner = true` es cortocircuito (super-admin del salón)

## Onboarding cerrado
No hay registro público. El flujo es:
1. Plataforma emite invitación (`invite_salon` RPC)
2. Invitado abre `/invite/[token]` → autenticación → `accept_invitation` RPC
3. La RPC valida token + email → crea salón + owner atómicamente

## Plataforma (super-admin SaaS)
- Área `/admin` — guard: `is_platform_admin()`
- Lee datos cross-tenant con `service_role` (cliente admin), nunca desde el browser
- Tablas: `platform_admins`, `salon_invitations`

## Citas
- Una sola representación: `appointments` (cabecera) + `appointment_items` (verdad)
- La exclusion constraint `no_overlap_per_employee` garantiza no-overlap a nivel DB
- El trigger `recalc_appointment` mantiene `start_time/end_time/total_price` consistentes
- El ciclo de vida: `scheduled → confirmed → completed | cancelled | no_show`
- Al cancelar/no_show: `blocks_calendar = false` en los items (liberan la agenda)

## Anti-patrones a evitar
- NO usar `.objects.all()` sin filtro de salón (la RLS lo garantiza pero el código también debe ser explícito)
- NO hacer lógica de negocio en componentes React ni Server Actions (solo orquestan)
- NO variables `any`; usar tipos generados de `supabase gen types`
- NO archivos > ~300 líneas — dividir por responsabilidad
- NO código dead (serializers/viewsets sin consumidor)
- NO hardcodear nombres de roles — siempre comprobar permisos

## Comandos útiles
```bash
npm run dev          # Servidor de desarrollo
npm run type-check   # TypeScript sin emitir
npm run db:types     # Regenerar tipos desde Supabase
supabase db push     # Aplicar migraciones
```

