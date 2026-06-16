import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-[var(--va-fg)] text-[var(--va-bg)] hover:opacity-90",
        destructive: "bg-[var(--va-danger)] text-white hover:opacity-90",
        outline: "border border-[var(--va-border)] bg-[var(--va-card)] text-[var(--va-fg)] hover:bg-[var(--va-hover)] hover:border-[var(--va-muted-soft)]",
        secondary: "bg-[var(--va-hover)] text-[var(--va-fg)] hover:opacity-80",
        ghost: "text-[var(--va-fg-2)] hover:bg-[var(--va-hover)] hover:text-[var(--va-fg)]",
        link: "text-[var(--va-accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        className: cn(buttonVariants({ variant, size, className }), (children.props as Record<string, unknown>)?.className),
        ref,
        ...props,
      })
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
