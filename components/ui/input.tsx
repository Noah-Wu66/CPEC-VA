import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[var(--radius-md)] border border-[var(--va-control-border)] bg-[var(--va-control-bg)] px-4 py-2 text-sm text-[var(--va-fg)] ring-offset-background transition-all placeholder:text-[var(--va-muted-soft)] hover:border-[var(--va-muted-soft)] focus-visible:border-[var(--va-fg)] focus-visible:outline-none focus-visible:ring-[var(--va-control-focus-shadow)] disabled:cursor-not-allowed disabled:bg-[var(--va-border-soft)] disabled:opacity-60 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
