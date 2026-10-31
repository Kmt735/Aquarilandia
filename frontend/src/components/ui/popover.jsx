import { cn } from "@/lib/utils"
import { Popover as PopoverPrimitive } from "radix-ui"

// Abre no clique, no toque e no teclado (Enter/Espaço) — diferente do Tooltip, que só abre no hover/foco
function Popover(props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({ className, align = "center", sideOffset = 6, children, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-(--z-overlay) w-72 max-w-[calc(100vw-24px)] origin-(--radix-popover-content-transform-origin) rounded-xl border border-border-strong bg-popover p-4 text-pequeno text-popover-foreground shadow-pop outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow className="fill-popover" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

const PopoverClose = PopoverPrimitive.Close

export { Popover, PopoverTrigger, PopoverContent, PopoverClose }
