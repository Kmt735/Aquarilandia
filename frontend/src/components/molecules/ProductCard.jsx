import Button from '../atoms/Button'
import Midia from '../atoms/Midia'
import Price from '../atoms/Price'
import Tag from '../atoms/Tag'
import WhatsAppButton from '../atoms/WhatsAppButton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { iconeCategoria } from '@/lib/icones'
import { formatarPreco } from '../../utils/format'

export default function ProductCard({ produto, onComprar, onWhatsApp }) {
  // Em oferta: `preco` é o valor com desconto e `precoOriginal` é o valor antigo
  const emOferta = produto.precoOriginal > produto.preco
  const desconto = emOferta ? Math.round((1 - produto.preco / produto.precoOriginal) * 100) : 0

  return (
    <Card id={produto.id} className="group gap-0 overflow-hidden rounded-card border-border bg-surface py-0 shadow-none transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      <Midia proporcao="4/3" icone={iconeCategoria[produto.categoria]}>
        <Tag positivo={produto.emEstoque} className="absolute top-3 left-3">
          {produto.emEstoque ? 'Em estoque' : 'Sob encomenda'}
        </Tag>
        {emOferta && (
          <Badge variant="destructive" className="absolute top-3 right-3 px-2.5 py-1 text-[11.5px]">
            -{desconto}%
          </Badge>
        )}
      </Midia>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h4 className="text-[17px] font-bold">{produto.nome}</h4>
        <p className="flex-1 text-[14px] leading-normal text-text-muted">{produto.descricao}</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <Price>{formatarPreco(produto.preco)}</Price>
          {emOferta && (
            <span className="text-[14px] text-text-muted line-through">{formatarPreco(produto.precoOriginal)}</span>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="buy" onClick={onComprar}>
            {produto.emEstoque ? 'Comprar' : 'Solicitar'}
          </Button>
          <WhatsAppButton onClick={onWhatsApp} label={`Perguntar sobre ${produto.nome} no WhatsApp`} />
        </div>
      </div>
    </Card>
  )
}