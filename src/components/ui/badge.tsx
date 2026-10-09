import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface-sunken text-fg-secondary",
        success: "bg-success-subtle text-success-fg",
        warning: "bg-warning-subtle text-warning-fg",
        danger: "bg-danger-subtle text-danger-strong",
        info: "bg-info-subtle text-info-fg",
        primary: "bg-accent-subtle text-accent-strong",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
