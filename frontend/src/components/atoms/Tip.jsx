import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// H10 · Ajuda e documentação: "?" com explicação ao passar o mouse ou focar
export default function Tip({ texto, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={texto}
          onClick={(e) => e.stopPropagation()}
          className="ml-1.5 inline-flex size-[18px] cursor-help items-center justify-center rounded-full border border-border-strong bg-surface align-[2px] text-[10px] font-semibold text-text-muted hover:border-neon/60 hover:text-primary-text"
          {...props}
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-xs leading-normal">{texto}</TooltipContent>
    </Tooltip>
  )
}
