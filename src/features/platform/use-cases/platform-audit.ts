import { recordPlatformAudit, type RecordPlatformAuditInput } from "@/features/platform/data/platform-audit.repo";
import { captureError } from "@/lib/observability";

export async function recordPlatformAction(input: RecordPlatformAuditInput): Promise<void> {
  if (!input.actorUserId) return;

  try {
    await recordPlatformAudit(input);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "record_audit",
      metadata: {
        auditAction: input.action,
        auditStatus: input.status,
        targetSalonId: input.targetSalonId,
        targetResourceId: input.targetResourceId,
      },
    });
  }
}
