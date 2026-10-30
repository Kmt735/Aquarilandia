import { Check } from 'lucide-react'

// Indicador de progresso em etapas (item 1 · visibilidade do status; item 37 · carga cognitiva).
// `etapas`: [{ id, rotulo }]; `atual`: índice. Etapas concluídas podem virar link (`hrefConcluida`).
export default function Stepper({ etapas, atual, rotulo = 'Etapas', renderLink }) {
  return (
    <nav aria-label={rotulo}>
      <ol className="flex items-start gap-1 sm:gap-2">
        {etapas.map((etapa, i) => {
          const feita = i < atual
          const ativa = i === atual
          const bolinha = (
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-display text-pequeno font-extrabold tabular-nums transition-colors ${
                ativa
                  ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                  : feita
                    ? 'border-primary-text bg-primary-soft text-primary-text'
                    : 'border-border-control bg-surface text-text-muted'
              }`}
            >
              {feita ? <Check aria-hidden="true" className="size-4" /> : i + 1}
            </span>
          )
          const conteudo = (
            <>
              {bolinha}
              <span className={`text-legenda leading-tight sm:text-pequeno ${ativa ? 'font-bold text-foreground' : 'text-text-muted'}`}>
                {etapa.rotulo}
                <span className="sr-only">{feita ? ' (concluída)' : ativa ? ' (etapa atual)' : ''}</span>
              </span>
            </>
          )
          return (
            <li key={etapa.id} aria-current={ativa ? 'step' : undefined} className="flex min-w-0 flex-1 items-start gap-1 sm:gap-2">
              {feita && renderLink ? (
                renderLink(etapa, i, conteudo)
              ) : (
                <span className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:text-left">{conteudo}</span>
              )}
              {i < etapas.length - 1 && (
                <span aria-hidden="true" className={`mt-[18px] h-0.5 min-w-3 flex-1 rounded-full ${feita ? 'bg-primary-text' : 'bg-border-strong'}`} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
