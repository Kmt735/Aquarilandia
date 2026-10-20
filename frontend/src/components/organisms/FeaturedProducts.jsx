import SectionHead from '../molecules/SectionHead'
import ProductGrid from './ProductGrid'
import { produtos } from '../../data/produtos'
import { ROTAS } from '../../utils/rotas'

export default function FeaturedProducts() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 desk:px-10 desk:py-24">
      <SectionHead
        eyebrow="Loja"
        titulo="Tudo pro seu aquário"
        link={{ to: ROTAS.loja, rotulo: 'Ver todos os produtos' }}
        className="mb-10 flex-wrap"
      />
      <ProductGrid produtos={produtos.slice(0, 3)} />
    </section>
  )
}
