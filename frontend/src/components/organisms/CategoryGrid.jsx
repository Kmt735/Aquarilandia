import { useNavigate } from 'react-router'
import Section from '../atoms/Section'
import CategoryCard from '../molecules/CategoryCard'
import SectionHead from '../molecules/SectionHead'
import { categoriasDestaque } from '../../data/categorias'
import { ROTAS, urlLoja } from '../../utils/rotas'

export default function CategoryGrid() {
  const navigate = useNavigate()

  return (
    <Section>
      <SectionHead
        eyebrow="Explore"
        titulo="Categorias de produtos"
        link={{ to: ROTAS.loja, rotulo: 'Ver loja completa →' }}
      />
      <div className="grid grid-cols-2 gap-4 desk:grid-cols-4">
        {categoriasDestaque.map((c) => (
          <CategoryCard
            key={c.rotulo}
            icone={c.icone}
            rotulo={c.rotulo}
            onClick={() => navigate(urlLoja({ categoria: c.categoria }))}
          />
        ))}
      </div>
    </Section>
  )
}
