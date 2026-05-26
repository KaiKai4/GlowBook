"use client";

import { useActionState, useState } from "react";
import { MessageSquareText, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  TEMPLATE_PLACEHOLDERS,
  renderMessageTemplate,
  type MessageTemplate,
} from "@/features/notifications/domain/templates";
import type { Result } from "@/lib/result";
import { updateNotificationTemplateAction } from "./actions";

const LABELS: Record<MessageTemplate["event"], { title: string; description: string }> = {
  appointment_reminder: {
    title: "Recordatorio de cita",
    description: "Se usa en el botón de WhatsApp del apartado Recordatorios.",
  },
  appointment_cancelled: {
    title: "Cancelación de cita",
    description: "Se usa cuando cancelas una cita y eliges notificar por WhatsApp.",
  },
};

const PREVIEW_CONTEXT = {
  cliente: "María González",
  fecha: "martes 26 de mayo",
  hora: "2:30 p. m.",
  servicios: "Corte, Secado",
  colaboradores: "Allan Ordoñez",
  salon: "WavyHair",
};

const initialState: Result<void> | null = null;

export function TemplatesManager({ templates }: { templates: MessageTemplate[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {templates.map((template) => (
        <TemplateCard key={template.event} template={template} />
      ))}
    </div>
  );
}

function TemplateCard({ template }: { template: MessageTemplate }) {
  const [state, formAction, pending] = useActionState(updateNotificationTemplateAction, initialState);
  const meta = LABELS[template.event];
  const fallback = DEFAULT_MESSAGE_TEMPLATES[template.event].body_text;
  const currentBody = template.body_text || fallback;
  const [bodyText, setBodyText] = useState(currentBody);
  const [isActive, setIsActive] = useState(template.is_active);
  const preview = renderMessageTemplate(bodyText, PREVIEW_CONTEXT);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-stone-100 bg-gradient-to-br from-brand-50 to-white">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-brand-600 shadow-sm">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{meta.title}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="event" value={template.event} />

          <Textarea
            name="body_text"
            label="Mensaje"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            className="min-h-[190px] leading-relaxed"
          />

          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="is_active"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            Usar esta plantilla personalizada
          </label>
          {!isActive && (
            <p className="-mt-2 text-xs text-stone-400">
              Si la desactivas, el sistema usará el mensaje base por defecto para este flujo.
            </p>
          )}

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <Sparkles className="h-3.5 w-3.5" />
              Variables disponibles
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                <code key={placeholder} className="rounded-full bg-white px-2 py-1 text-xs text-brand-700">
                  {placeholder}
                </code>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
              Vista previa
            </p>
            <p className="whitespace-pre-line text-sm text-stone-700">{preview}</p>
          </div>

          {state && !state.ok && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Plantilla guardada.
            </p>
          )}

          <Button type="submit" variant="primary" loading={pending}>
            <Save className="h-4 w-4" />
            Guardar plantilla
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
