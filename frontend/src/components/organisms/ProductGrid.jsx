import ProductCard from '../molecules/ProductCard'
import useCart from '../../hooks/useCart'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function ProductGrid({ produtos }) {
  const { adicionar } = useCart()
  const abrirWhatsApp = useWhatsApp()

  return (
    <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 desk:grid-cols-3">
      {produtos.map((produto) => (
        <ProductCard
          key={produto.id}
          produto={produto}
          onComprar={() => (produto.emEstoque ? adicionar(produto) : abrirWhatsApp(`consultar ${produto.nome}`))}
          onWhatsApp={() => abrirWhatsApp(produto.nome)}
        />
      ))}
    </div>
  )
}
