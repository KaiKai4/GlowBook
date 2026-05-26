# ADR 0005: Onboarding Cerrado Por Invitaciones De Plataforma

## Estado

Aceptada.

## Contexto

GlowBook no debe permitir que cualquier persona con el link cree un salon. La plataforma controla que salones entran al SaaS.

## Decision

No hay registro publico de salones. La plataforma crea una invitacion en `salon_invitations`, asociada a un email y token.

El usuario invitado acepta desde `/invite/[token]`. La RPC valida token, estado, expiracion y que el email autenticado coincida con el email invitado antes de crear el salon y su owner.

El area `/admin` es para superadmin de plataforma y debe protegerse con `is_platform_admin()`.

## Consecuencias

Crear una cuenta Auth no da acceso a ningun salon por si sola.

La creacion de salones queda controlada y auditable.

Los flujos de invitacion deben cuidar expiracion, revocacion y coincidencia de email.
