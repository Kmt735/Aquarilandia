import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Etapas do "Monte seu Aquário" (mesmo visual do Stepper do checkout). Etapas concluídas viram botão:
// o cliente volta a qualquer uma sem perder as escolhas. A atual tem aria-current="step".
export default function BuilderStepper({ etapas, atual, concluidas, onIr }) {
  return (
    <nav aria-label="Etapas da montagem">
      <ol className="flex items-start gap-1 sm:gap-2">
        {etapas.map((etapa, i) => {
          const ativa = i === atual
          const feita = concluidas.includes(etapa.id) && !ativa
          const bolinha = (
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-display text-pequeno font-extrabold tabular-nums transition-colors',
                ativa ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                  : feita ? 'border-primary-text bg-primary-soft text-primary-text'
                    : 'border-border-control bg-surface text-text-muted',
              )}
            >
              {feita ? <Check aria-hidden="true" className="size-4" /> : i + 1}
            </span>
          )
          const texto = (
            <span className={cn('text-legenda leading-tight max-sm:sr-only sm:text-pequeno', ativa ? 'font-bold text-foreground' : 'text-text-muted')}>
              {etapa.rotulo}
              <span className="sr-only">{feita ? ' (concluída)' : ativa ? ' (etapa atual)' : ''}</span>
            </span>
          )
          const conteudo = <>{bolinha}{texto}</>
          const classe = 'flex min-w-0 flex-col items-center gap-1.5 text-center desk:flex-row desk:text-left'
          return (
            <li key={etapa.id} aria-current={ativa ? 'step' : undefined} className="flex min-w-0 flex-1 items-start gap-1 sm:gap-2">
              {feita ? (
                <button type="button" onClick={() => onIr(i)} className={cn(classe, 'rounded-lg outline-none hover:[&>span:first-child]:shadow-glow focus-visible:ring-2 focus-visible:ring-ring')}>
                  {conteudo}
                </button>
              ) : (
                <span className={classe}>{conteudo}</span>
              )}
              {i < etapas.length - 1 && (
                <span aria-hidden="true" className={cn('mt-[18px] h-0.5 min-w-2 flex-1 rounded-full', feita ? 'bg-primary-text' : 'bg-border-strong')} />
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-pequeno text-text-muted sm:hidden" aria-hidden="true">
        Etapa {atual + 1} de {etapas.length}: <strong className="text-foreground">{etapas[atual].rotulo}</strong>
      </p>
    </nav>
  )
}
