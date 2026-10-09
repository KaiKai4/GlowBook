import { formText, type FormFieldSource } from "@/infra/validation/form-fields";

// Formulario de moderacion de feedback: cualquier valor distinto de "resolved"
// vuelve el reporte a "new".

export interface FeedbackStatusForm {
  id: string;
  status: "new" | "resolved";
}

export function readFeedbackStatusForm(source: FormFieldSource): FeedbackStatusForm {
  return {
    id: formText(source.get("id")),
    status: formText(source.get("status")) === "resolved" ? "resolved" : "new",
  };
}
