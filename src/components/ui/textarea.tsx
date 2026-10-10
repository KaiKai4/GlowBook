import { cn } from "@/components/ui/cn";
import { forwardRef } from "react";
import { Field } from "@/components/forms/field";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <Field id={id} label={label} error={error} hint={hint}>
      {(control) => (
        <textarea
          ref={ref}
          id={control.id}
          aria-invalid={Boolean(error)}
          aria-describedby={control["aria-describedby"]}
          className={cn(
            "w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 text-sm text-fg",
            "placeholder:text-fg-subtle resize-y min-h-[80px]",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
            error && "border-danger focus:ring-danger",
            className
          )}
          {...props}
        />
      )}
    </Field>
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
