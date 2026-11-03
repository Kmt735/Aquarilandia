import { ArrowLeft, ArrowRight, SkipForward } from 'lucide-react'
import { forwardRef } from 'react'
import Button from '../atoms/Button'

// Uma etapa do "Monte seu Aquário": título (recebe o foco ao trocar de etapa), conteúdo e navegação.
// Opcionais têm "Pular etapa". Avançar nunca é bloqueado por aviso.
const BuilderStep = forwardRef(function BuilderStep({ etapa, indice, total, children, onVoltar, onProximo, onPular, rotuloProximo }, refTitulo) {
  const idTitulo = `etapa-${etapa.id}-titulo`
  return (
    <section aria-labelledby={idTitulo} className="min-w-0">
      <p className="text-pequeno font-bold text-primary-text">
        Etapa {indice + 1} de {total}
        {etapa.opcional && <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-micro font-semibold text-text-muted">Opcional</span>}
      </p>
      <h2 id={idTitulo} ref={refTitulo} tabIndex={-1} className="mt-1 text-h2 outline-none">{etapa.titulo}</h2>
      <p className="mt-2 max-w-[640px] text-corpo text-text-muted">{etapa.descricao}</p>

      <div className="mt-6">{children}</div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        {indice > 0 && (
          <Button variant="secundario" onClick={onVoltar}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-3">
          {etapa.opcional && (
            <Button variant="terciario" onClick={onPular}>
              Pular etapa
              <SkipForward aria-hidden="true" />
            </Button>
          )}
          <Button onClick={onProximo}>
            {rotuloProximo ?? 'Próximo'}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  )
})

export default BuilderStep
