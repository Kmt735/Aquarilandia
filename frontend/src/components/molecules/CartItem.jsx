import { Link } from 'react-router'
import Imagem from '../atoms/Imagem'
import Preco from '../atoms/Preco'
import SeletorQuantidade from './SeletorQuantidade'
import { formatarPreco } from '../../utils/format'
import { urlItem } from '../../utils/rotas'

export default function CartItem({ linha, onQtd, onRemover, onNavegar }) {
  const { item, qtd } = linha
  return (
    <li className="flex items-start gap-3.5 border-b border-border py-4">
      <div className="w-16 shrink-0 overflow-hidden rounded-xl">
        <Imagem src={item.imagens?.[0]?.src} alt="" categoria={item.categoria} proporcao="1/1" compacta />
      </div>
      <div className="min-w-0 flex-1">
        <Link to={urlItem(item)} onClick={onNavegar} className="alvo-toque font-display text-corpo font-bold hover:text-primary-text hover:underline">
          {item.nome}
        </Link>
        <div className="mt-0.5">
          <Preco valor={item.preco * qtd} tamanho="sm" />
          {qtd > 1 && <span className="ml-1.5 text-legenda text-text-muted">({qtd} × {formatarPreco(item.preco)})</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <SeletorQuantidade compacto valor={qtd} max={item.estoque} onChange={onQtd} rotulo={`Quantidade de ${item.nome}`} />
          <button
            type="button"
            onClick={onRemover}
            className="alvo-toque rounded-full px-1 text-pequeno font-semibold text-text-muted underline underline-offset-4 hover:text-danger-text"
            aria-label={`Remover ${item.nome} do carrinho`}
          >
            Remover
          </button>
        </div>
      </div>
    </li>
  )
}
