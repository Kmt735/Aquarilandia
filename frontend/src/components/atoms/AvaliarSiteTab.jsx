import { MessageSquareHeart } from 'lucide-react'

// Aba discreta na lateral ESQUERDA (meio da tela): a direita já tem o VLibras (meio) e o WhatsApp (canto inferior).
// Sem o amarelo do WhatsApp: superfície neutra + texto azul. No celular vira só o ícone (44 × 44) para não cobrir o conteúdo.
export default function AvaliarSiteTab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Avalie o site"
      title="Avalie o site"
      className="fixed top-1/2 left-0 z-(--z-flutuante) flex size-11 -translate-y-1/2 items-center justify-center gap-2 rounded-r-xl border border-l-0 border-border-strong bg-surface-elevated text-primary-text shadow-soft transition-[background-color,padding] duration-(--dur-media) hover:bg-surface-muted desk:h-auto desk:w-11 desk:flex-col desk:py-3 desk:hover:pl-1"
    >
      <MessageSquareHeart aria-hidden="true" className="size-5 shrink-0" />
      <span aria-hidden="true" className="hidden text-pequeno font-bold [writing-mode:vertical-rl] rotate-180 desk:inline">
        Avalie o site
      </span>
    </button>
  )
}
