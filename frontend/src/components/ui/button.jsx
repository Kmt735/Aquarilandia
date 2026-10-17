import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-neon",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "border border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary-text dark:hover:border-neon/50 dark:hover:shadow-[0_0_10px_-3px_var(--neon-glow)]",
        secondary: "bg-surface-muted text-foreground hover:bg-primary-soft hover:text-primary-text",
        ghost: "text-text-muted hover:bg-surface-muted hover:text-primary-text",
        link: "text-primary-text underline decoration-border-strong underline-offset-4 hover:decoration-neon",
      },
      size: {
        default: "h-10 px-5 has-[>svg]:px-4",
        xs: "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 text-[13px] has-[>svg]:px-3",
        lg: "h-12 rounded-xl px-6 text-[15px] has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
