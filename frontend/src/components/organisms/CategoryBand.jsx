import WaterWave from '../atoms/WaterWave'
import CategoryCard from '../molecules/CategoryCard'
import SectionHead from '../molecules/SectionHead'
import { iconeCategoria } from '@/lib/icones'
import { categoriasDestaque } from '../../data/categorias'
import { ROTAS, urlLoja } from '../../utils/rotas'

// Faixa azul de largura total com a superfície de água animada no topo
export default function CategoryBand() {
  return (
    <section className="bg-surface-tint">
      <WaterWave bolhas />
      <div className="bg-primary">
        <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 desk:px-10 desk:pt-4 desk:pb-20">
          <SectionHead
            tom="claro"
            eyebrow="Explore"
            titulo="Categorias de produtos"
            link={{ to: ROTAS.loja, rotulo: 'Ver loja completa →' }}
            className="mb-8 flex-wrap"
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 desk:grid-cols-4">
            {categoriasDestaque.map((c) => (
              <CategoryCard
                key={c.rotulo}
                icone={iconeCategoria[c.categoria]}
                rotulo={c.rotulo}
                to={urlLoja({ categoria: c.categoria })}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
