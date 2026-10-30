"use client"

import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Toggle as TogglePrimitive } from "radix-ui"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-pequeno font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-(--dur-rapida) disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent text-text-muted hover:text-foreground",
        outline: "border border-border-control bg-surface text-foreground hover:border-primary-text hover:text-primary-text",
      },
      size: {
        default: "alvo-toque h-10 min-w-10 px-4",
        sm: "alvo-toque h-8 min-w-8 px-2",
        lg: "h-11 min-w-11 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
