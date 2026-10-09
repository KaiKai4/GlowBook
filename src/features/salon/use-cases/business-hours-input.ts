import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { BusinessHoursSchema, type BusinessDayInput } from "../schemas";

const INVALID_JSON_MESSAGE = "Datos de horario invalidos.";

// Lee el horario que llega serializado desde el formulario y lo valida contra el
// esquema (7 dias, horas coherentes). Sin I/O: el caso de uso solo persiste.
export function parseBusinessHoursJson(json: string): Result<BusinessDayInput[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return err(INVALID_JSON_MESSAGE);
  }

  const parsed = BusinessHoursSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(firstIssueMessage(parsed.error));
}
