import { useNavigate } from 'react-router'
import Section from '../atoms/Section'
import FishCard from '../molecules/FishCard'
import SectionHead from '../molecules/SectionHead'
import { peixesDestaque } from '../../data/peixes'
import { ROTAS } from '../../utils/rotas'

export default function FeaturedFish() {
  const navigate = useNavigate()

  return (
    <Section>
      <SectionHead
        eyebrow="Disponíveis agora"
        titulo="Peixes em destaque"
        link={{ to: ROTAS.peixes, rotulo: 'Ver todos os peixes →' }}
      />
      <div className="flex gap-[18px] overflow-x-auto pb-2">
        {peixesDestaque.map((peixe) => (
          <FishCard key={peixe.nome} peixe={peixe} onClick={() => navigate(ROTAS.peixes)} />
        ))}
      </div>
    </Section>
  )
}
