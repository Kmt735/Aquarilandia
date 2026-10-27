import SectionHead from '../molecules/SectionHead'
import ProductGrid from './ProductGrid'
import { produtos } from '../../data/produtos'
import { ROTAS } from '../../utils/rotas'

// Produtos com `precoOriginal` maior que `preco` entram aqui
export default function OfferStrip() {
  const ofertas = produtos.filter((p) => p.precoOriginal > p.preco).slice(0, 3)
  if (ofertas.length === 0) return null

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 desk:px-10 desk:py-24">
      <SectionHead
        eyebrow="Ofertas"
        titulo="Ofertas da semana"
        link={{ to: ROTAS.loja, rotulo: 'Ver todos os produtos' }}
        className="mb-10 flex-wrap"
      />
      <ProductGrid produtos={ofertas} />
    </section>
  )
}