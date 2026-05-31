# Platform Module

Responsabilidad: administracion global de plataforma, invitaciones de Salon,
moderacion de feedback, overview cross-tenant, audit log de acciones Platform y
borrado completo de Salon.

Interface principal:

- `use-cases/invite-salon.ts`
- `use-cases/accept-invitation.ts`
- `use-cases/get-platform-admin-home.ts`
- `use-cases/get-platform-audit-log.ts`
- `use-cases/get-platform-invitations.ts`
- `use-cases/get-platform-salon-overviews.ts`
- `use-cases/get-platform-feedback-reports.ts`
- `use-cases/platform-audit.ts`
- `use-cases/update-salon-status.ts`
- `use-cases/update-salon-features.ts`
- `use-cases/delete-salon.ts`

Autoridad final:

- Platform requiere verificacion server-side de Platform admin.
- SQL/RPC mantiene operaciones irreversibles transaccionales cuando aplica.
- ADR 0010 define que Adapters pueden usar `service_role`.
- Las acciones Platform de alto impacto deben registrar resultado en
  `platform_audit_log`.

Adapters externos:

- `data/invitations.repo.ts`
- `data/salons.repo.ts`
- `data/salon-overviews.repo.ts`
- `data/platform-audit.repo.ts`
- `data/feedback-moderation.repo.ts`
- `data/delete-salon.repo.ts`
- `data/platform-auth.repo.ts`

Tests que protegen el Module:

- `use-cases/accept-invitation.test.ts`
- `use-cases/delete-salon.test.ts`
- `use-cases/get-platform-admin-home.test.ts`
- `use-cases/get-platform-audit-log.test.ts`
- `use-cases/get-platform-invitations.test.ts`
- `use-cases/get-platform-feedback-reports.test.ts`
- `use-cases/get-platform-salon-overviews.test.ts`
- `use-cases/invite-salon.test.ts`
- `use-cases/set-feedback-report-status.test.ts`
- `use-cases/update-salon-status.test.ts`
- `use-cases/update-salon-features.test.ts`

No debe vivir aqui:

- reglas operativas tenant normales del Salon.
- bypass de RLS por conveniencia.
- UI de dashboard de Salon.
