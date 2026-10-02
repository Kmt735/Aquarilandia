import Button from '../atoms/Button'
import EmojiPhoto from '../atoms/EmojiPhoto'
import Price from '../atoms/Price'
import Tag from '../atoms/Tag'
import WhatsAppButton from '../atoms/WhatsAppButton'
import { formatarPreco } from '../../utils/format'

export default function ProductCard({ produto, onComprar, onWhatsApp, marcarHeuristicas = false }) {
  return (
    <article id={produto.id} className="flex flex-col overflow-hidden rounded-card border border-line bg-panel">
      <EmojiPhoto variante="produto" className="h-[150px] text-4xl">
        {produto.icone}
        <Tag
          positivo={produto.emEstoque}
          className="absolute top-2.5 left-2.5"
          data-h={marcarHeuristicas ? 'H1 Status do estoque' : undefined}
        >
          {produto.emEstoque ? 'Em estoque' : 'Sob encomenda'}
        </Tag>
      </EmojiPhoto>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h4 className="font-display text-[14.5px] font-bold">{produto.nome}</h4>
        <p className="flex-1 text-xs leading-[1.4] text-ink-soft">{produto.descricao}</p>
        <Price>{formatarPreco(produto.preco)}</Price>
        <div className="mt-2 flex gap-2">
          <Button
            variant="buy"
            onClick={onComprar}
            data-h={marcarHeuristicas ? 'H4 Ação principal consistente' : undefined}
          >
            {produto.emEstoque ? 'Comprar' : 'Solicitar'}
          </Button>
          <WhatsAppButton onClick={onWhatsApp} label={`Perguntar sobre ${produto.nome} no WhatsApp`} />
        </div>
      </div>
    </article>
  )
}
