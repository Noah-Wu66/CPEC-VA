import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[var(--va-fg)] bg-[var(--va-fg)] text-[var(--va-bg)]",
        secondary:
          "border-[var(--va-border)] bg-[var(--va-hover)] text-[var(--va-fg-2)]",
        destructive:
          "border-[var(--va-danger-border)] bg-[var(--va-danger-soft)] text-[var(--va-danger)]",
        outline: "border-[var(--va-border)] bg-transparent text-[var(--va-muted)]",
        success:
          "border-[var(--va-success-border)] bg-[var(--va-success-soft)] text-[var(--va-success)]",
        warning:
          "border-[var(--warning-border)] bg-[var(--warning-light)] text-hsl(var(--warning))",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
