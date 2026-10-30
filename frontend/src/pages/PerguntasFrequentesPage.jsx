import { MessageCircle } from 'lucide-react'
import Button from '../components/atoms/Button'
import FaqItem from '../components/molecules/FaqItem'
import PageTemplate from '../components/templates/PageTemplate'
import { Accordion } from '@/components/ui/accordion'
import { perguntasFrequentes } from '../data/faq'
import { perguntasLoja } from '../data/loja'
import useWhatsApp from '../hooks/useWhatsApp'
import { ROTAS } from '../utils/rotas'

// Item 10 · Perguntas frequentes sobre entrega (com a regra dos peixes), trocas e pagamento
export default function PerguntasFrequentesPage() {
  const abrirWhatsApp = useWhatsApp()
  const grupos = [...new Set(perguntasLoja.map((p) => p.grupo))]
  const secoes = [
    ...grupos.map((g) => ({ titulo: g, perguntas: perguntasLoja.filter((p) => p.grupo === g) })),
    { titulo: 'Primeiro aquário', perguntas: perguntasFrequentes.filter((p) => !p.pendente) },
  ]

  return (
    <PageTemplate
      eyebrow="Ajuda"
      titulo="Perguntas frequentes"
      descricao="Entrega, trocas, pagamento e primeiros passos."
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Perguntas frequentes' }]}
    >
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-10 sm:px-6 desk:grid-cols-[220px_1fr] desk:px-10 desk:py-14">
        <nav aria-label="Assuntos" className="desk:sticky desk:top-24 desk:self-start">
          <ul className="flex flex-wrap gap-2 desk:flex-col">
            {secoes.map((s) => (
              <li key={s.titulo}>
                <a href={`#${s.titulo}`} className="inline-flex min-h-11 items-center rounded-full border border-border-control px-4 text-pequeno font-semibold hover:border-primary-text hover:text-primary-text desk:rounded-xl desk:border-0">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-10">
          {secoes.map((s) => (
            <section key={s.titulo} id={s.titulo} aria-labelledby={`faq-${s.titulo}`}>
              <h2 id={`faq-${s.titulo}`} className="mb-2 text-h2">
                {s.titulo}
              </h2>
              <Accordion type="multiple" className="border-t border-border-strong">
                {s.perguntas.map((p) => (
                  <FaqItem key={p.pergunta} {...p} />
                ))}
              </Accordion>
            </section>
          ))}
          <div className="rounded-card border border-border-strong bg-surface-tint p-6">
            <h2 className="text-h3">Não achou sua dúvida?</h2>
            <p className="mt-1 text-corpo text-text-muted">A equipe da loja responde pelo WhatsApp.</p>
            <Button variant="secundario" className="mt-4" onClick={() => abrirWhatsApp()}>
              <MessageCircle aria-hidden="true" />
              Perguntar no WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </PageTemplate>
  )
}
