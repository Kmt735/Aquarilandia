import { Check } from 'lucide-react'
import Tip from '../atoms/Tip'

export default function TimelineItem({ ref, numero, passo, guiando, estado, ultimo }) {
  const opacidade = !guiando ? '' : estado === 'atual' ? 'opacity-100' : estado === 'feito' ? 'opacity-75' : 'opacity-40'
  const numeroCls =
    estado === 'atual'
      ? 'border-primary bg-primary text-primary-foreground shadow-neon'
      : estado === 'feito'
        ? 'border-primary/40 bg-primary-soft text-primary-text'
        : 'border-border-strong bg-surface text-primary-text dark:text-neon'

  return (
    <div ref={ref} className={`relative flex gap-6 transition-opacity ${ultimo ? '' : 'pb-11'} ${opacidade}`}>
      {!ultimo && <span aria-hidden="true" className="absolute top-12 bottom-1 left-[21px] w-px bg-border-strong" />}
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-full border font-display text-[15px] font-semibold tabular-nums ${numeroCls}`}
      >
        {estado === 'feito' ? <Check aria-label={`Etapa ${numero} concluída`} className="size-4" /> : numero}
      </div>
      <div className="pt-2">
        <h4 className="mb-1.5 text-[18px]">
          {passo.titulo}
          {passo.dica && <Tip texto={passo.dica} />}
        </h4>
        <p className="max-w-[520px] text-[14.5px] leading-relaxed text-text-muted">{passo.descricao}</p>
      </div>
    </div>
  )
}
