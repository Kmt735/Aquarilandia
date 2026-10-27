import SectionHead from '../molecules/SectionHead'
import ServiceCard from '../molecules/ServiceCard'
import { servicos } from '../../data/servicos'
import { ROTAS } from '../../utils/rotas'

// Faixa da Home com os serviços marcados como `destaque` no servicos.js
export default function ServicesPreview() {
  const destaques = servicos.filter((s) => s.destaque).slice(0, 3)
  if (destaques.length === 0) return null

  return (
    <section className="bg-surface-tint">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 desk:px-10 desk:py-24">
        <SectionHead
          eyebrow="Serviços"
          titulo="A gente monta e cuida pra você"
          link={{ to: ROTAS.servicos, rotulo: 'Ver todos os serviços' }}
          className="mb-10 flex-wrap"
        />
        <div className="grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3">
          {destaques.map((servico) => (
            <div key={servico.id} className="flex bg-surface [&>*]:flex-1">
              <ServiceCard servico={servico} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}