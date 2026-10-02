import Section from '../atoms/Section'
import SectionHead from '../molecules/SectionHead'
import ServiceCard from '../molecules/ServiceCard'
import { servicos } from '../../data/servicos'
import { ROTAS } from '../../utils/rotas'

export default function ServicesPreview() {
  return (
    <Section>
      <SectionHead
        eyebrow="Projetos de aquários"
        titulo="Serviços"
        link={{ to: ROTAS.servicos, rotulo: 'Ver todos →' }}
      />
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 desk:grid-cols-3">
        {servicos
          .filter((s) => s.destaque)
          .map((servico) => (
            <ServiceCard key={servico.id} servico={servico} />
          ))}
      </div>
    </Section>
  )
}
