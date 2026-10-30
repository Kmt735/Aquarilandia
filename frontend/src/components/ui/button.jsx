import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// Hierarquia (STYLEGUIDE.md › Botões): no máximo 1 `default` (primário) por bloco — item 29 · atenção
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-(--dur-rapida) ease-saida active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        // Primário: a única cor de ação principal do site
        default: "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-glow",
        // Amarelo: só carrinho do cabeçalho e WhatsApp flutuante, sempre com texto marinho
        accent: "bg-accent text-accent-foreground hover:bg-accent-hover hover:shadow-glow-accent",
        destructive: "bg-destructive text-danger-foreground hover:bg-destructive/90",
        // Secundário: contorno
        outline:
          "border border-border-control bg-transparent text-foreground hover:border-primary-text hover:bg-surface-tint hover:text-primary-text",
        secondary: "bg-surface-tint text-foreground hover:bg-primary-soft hover:text-primary-text",
        // Terciário: texto azul sem caixa
        ghost: "text-primary-text hover:bg-surface-tint",
        link: "h-auto! px-0! text-primary-text underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-11 px-5 text-pequeno has-[>svg]:px-4",
        xs: "alvo-toque h-8 gap-1 px-3 text-legenda [&_svg:not([class*='size-'])]:size-3.5",
        sm: "alvo-toque h-9 gap-1.5 px-4 text-legenda has-[>svg]:px-3",
        lg: "h-12 px-7 text-corpo has-[>svg]:px-6",
        icon: "size-11",
        "icon-sm": "alvo-toque size-9",
        "icon-lg": "size-12",
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
