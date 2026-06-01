# Capacity Plan Supabase/Vercel

Fecha: 2026-06-01

## Objetivo

Definir que debe revisarse antes de operar GlowBook con muchos salones reales.

## Estado Actual

El repo esta preparado para medir capacidad. En las capturas revisadas durante
la auditoria, el proyecto aparecia en Vercel Hobby y Supabase Free. Antes de
lanzamiento amplio, confirmar estos valores en los dashboards porque los
limites reales pueden cambiar por plan, add-ons o region.

Fuentes oficiales revisadas:

- Vercel Runtime Logs: https://vercel.com/docs/observability/runtime-logs/
- Vercel Drains: https://vercel.com/docs/log-drains
- Vercel Limits: https://vercel.com/docs/limits/overview
- Vercel Functions Limits: https://vercel.com/docs/functions/limitations/
- Supabase Pricing: https://supabase.com/pricing
- Supabase Database Size: https://supabase.com/docs/guides/platform/database-size
- Supabase Backups: https://supabase.com/docs/guides/platform/backups
- Supabase Compute: https://supabase.com/docs/guides/platform/compute-add-ons/

## Supabase

Completar antes de crecer a 25-50 salones:

- [x] Plan actual observado: Free.
- [ ] Region.
- [ ] Backups habilitados. En Free no hay automatic backups incluidos; usar dump externo o subir de plan antes de datos reales amplios.
- [ ] Retencion de backups.
- [ ] Limite de conexiones Postgres.
- [ ] Pooler disponible/configurado.
- [ ] Limites de Auth.
- [ ] Retencion de logs. Pro incluye 7 dias de log retention segun pricing oficial; Free requiere confirmar dashboard.
- [ ] Storage/bandwidth si se agregan archivos.

Senales para subir de plan:

- conexiones cerca del limite;
- queries lentas persistentes;
- backups/restore no cumplen RTO/RPO;
- logs insuficientes para soporte;
- Auth rate limits aparecen en login/invitaciones.

## Vercel

Completar antes de crecer a 25-50 salones:

- [x] Plan actual observado: Hobby.
- [ ] Region/deploy target.
- [x] Function duration revisada en docs oficiales: Hobby permite funciones dentro de limites y duration configurable hasta el maximo documentado.
- [x] Retencion de logs revisada en docs oficiales: Hobby mantiene runtime logs por 1 hora; Pro por 1 dia; Observability Plus amplia retencion.
- [ ] Bandwidth mensual.
- [x] Opciones de log drain revisadas: Vercel Drains requiere Pro o Enterprise.
- [ ] Alertas disponibles.

Senales para subir de plan:

- Function Invocation cerca del maximo;
- errores 5xx bajo carga;
- logs con retencion insuficiente;
- necesidad de equipo/roles/alertas avanzadas;
- bandwidth cerca del limite.

## Umbrales Iniciales

| Etapa | Salones | Accion |
|---|---:|---|
| Piloto | 5-10 | Vercel Logs + Supabase dashboard manual. |
| Crecimiento | 25-50 | Revisar limites semanalmente; Free/Hobby puede servir solo si datos/traffic se mantienen bajos. |
| Amplio | 100+ | Recomendado subir a planes con backups/log retention/log drain segun necesidad operativa. |

## Decision 2026-06-01

Para piloto y crecimiento controlado, el stack actual puede seguir usandose con
monitoreo cercano. Para lanzamiento amplio, no conviene depender solo de
Supabase Free y Vercel Hobby si habra datos reales de muchos salones:

- Supabase Free no incluye automatic backups y tiene limite de 500 MB de base
  antes de riesgo de modo read-only.
- Vercel Hobby solo retiene runtime logs por 1 hora.
- Vercel Drains requiere Pro o Enterprise.

Decision recomendada antes de 100+ salones reales:

1. Subir Supabase al menos a Pro o definir backups externos automatizados.
2. Usar Vercel Pro si se necesita log drain/retencion superior.
3. Mantener `release:scale-readiness` bloqueado hasta confirmar plan y
   observability.

Evidencia ya completada:

- Fase 48 dataset 25/50/100 salones con cleanup.
- Fase 49 Supabase advisors sin issues con 100 salones.
- Fase 52 restore local con dataset de 100 salones.

Evidencia todavia pendiente:

- Medicion de rutas y Vercel Logs con usuarios reales.
- Confirmacion de limites finos en dashboard: region, conexiones, Auth,
  bandwidth y alertas.
- Decision de observability/log drain y backups automaticos para operacion
  amplia.
