import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import Button from '../atoms/Button'
import TextoComTermos from '../atoms/TextoComTermos'
import IlustracaoPasso from './IlustracaoPasso'
import { cn } from '@/lib/utils'

// O html já desconta o cabeçalho (scroll-padding-top); aqui entra só a barra do guia no celular
export const ROLAGEM_GUIA = 'scroll-mt-5 desk:scroll-mt-0'

// Um passo do guia: número + título (H2), introdução, conteúdo e navegação para os vizinhos
export default function GuideStep({ passo, numero, total, anterior, proximo, entendido, onEntendi, onIr, children }) {
  const irPara = (id) => (e) => {
    e.preventDefault()
    onIr(id)
  }

  return (
    <section id={passo.id} aria-labelledby={`titulo-${passo.id}`} className={cn('border-b border-border py-12 last:border-b-0 desk:py-14', ROLAGEM_GUIA)}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary font-display text-h3 font-extrabold text-primary-foreground tabular-nums">
            {numero}
          </span>
          <h2 id={`titulo-${passo.id}`} tabIndex={-1} className="text-h2 text-primary-dark outline-none dark:text-foreground">
            <span className="mb-1 block font-sans text-pequeno font-bold text-primary-text">
              Passo {numero} de {total}
            </span>
            {passo.titulo}
          </h2>
        </div>
        <IlustracaoPasso id={passo.id} className="w-24 shrink-0 max-sm:hidden" />
      </div>

      <div className="mt-5 max-w-[640px] space-y-3 text-corpo text-text-muted">
        {passo.intro.map((p) => (
          <p key={p}>
            <TextoComTermos>{p}</TextoComTermos>
          </p>
        ))}
      </div>

      <div className="mt-7 space-y-6">{children}</div>

      <div className="mt-8 flex flex-col gap-3">
        <div>
          <Button variant="terciario" aria-pressed={entendido} className="aria-pressed:bg-primary-soft" onClick={() => onEntendi(passo.id)}>
            <Check aria-hidden="true" className={entendido ? '' : 'opacity-40'} />
            Entendi
          </Button>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {anterior ? (
            <Button variant="secundario" asChild>
              <a href={`#${anterior.id}`} onClick={irPara(anterior.id)}>
                <ArrowLeft aria-hidden="true" />
                Anterior
              </a>
            </Button>
          ) : (
            <span />
          )}
          <Button asChild>
            <a href={`#${proximo.id}`} onClick={irPara(proximo.id)}>
              {proximo.rotulo}
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
