import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// Selos: o texto sempre diz o estado (nada depende só da cor). Para status use atoms/StatusBadge.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 py-1 text-micro font-bold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-surface-muted text-text-muted",
        soft: "bg-primary-soft text-primary-text",
        accent: "bg-accent text-accent-foreground",
        outline: "border-border-strong text-foreground",
        destructive: "bg-danger text-danger-foreground",
        sucesso: "bg-success-soft text-success-text",
        aviso: "bg-warning-soft text-warning-text",
        erro: "bg-danger-soft text-danger-text",
        info: "bg-info-soft text-info-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
