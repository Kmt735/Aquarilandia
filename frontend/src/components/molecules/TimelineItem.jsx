import { Check } from 'lucide-react'
import Termo from '../atoms/Termo'

export default function TimelineItem({ ref, numero, passo, estado, ultimo }) {
  const numeroCls =
    estado === 'atual'
      ? 'border-primary bg-primary text-primary-foreground shadow-glow'
      : estado === 'feito'
        ? 'border-primary-text bg-primary-soft text-primary-text'
        : 'border-border-control bg-surface text-primary-text'

  return (
    <div ref={ref} className={`relative flex gap-5 ${ultimo ? '' : 'pb-9'}`}>
      {!ultimo && <span aria-hidden="true" className="absolute top-12 bottom-1 left-[21px] w-0.5 rounded-full bg-border-strong" />}
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 font-display text-corpo font-extrabold tabular-nums ${numeroCls}`}>
        {estado === 'feito' ? <Check aria-hidden="true" className="size-4" /> : numero}
      </div>
      <div className={`pt-2 ${estado === 'atual' ? '' : ''}`}>
        <h3 className="mb-1 text-h4">
          <span className="sr-only">Etapa {numero}{estado === 'feito' ? ' (concluída)' : estado === 'atual' ? ' (etapa atual)' : ''}: </span>
          {passo.titulo}
        </h3>
        <p className="max-w-[560px] text-corpo text-text-muted">{passo.descricao}</p>
        {passo.termo && (
          <p className="mt-1.5 text-pequeno text-text-muted">
            Termo novo: <Termo id={passo.termo} />
          </p>
        )}
      </div>
    </div>
  )
}
