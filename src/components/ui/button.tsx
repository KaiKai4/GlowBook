import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-sm",
  {
    variants: {
      variant: {
        default: "bg-fg text-surface hover:bg-fg-secondary focus-visible:ring-fg",
        destructive: "bg-danger text-surface hover:bg-danger-strong focus-visible:ring-danger",
        outline: "border border-border bg-surface text-fg-secondary hover:bg-surface-muted focus-visible:ring-fg-subtle",
        ghost: "text-fg-muted hover:bg-surface-sunken hover:text-fg focus-visible:ring-fg-subtle",
        link: "text-fg underline-offset-4 hover:underline",
        primary: "bg-brand-600 text-surface hover:bg-brand-700 focus-visible:ring-brand-600 shadow-sm",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
