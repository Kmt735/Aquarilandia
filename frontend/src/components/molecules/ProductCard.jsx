import Button from '../atoms/Button'
import Midia from '../atoms/Midia'
import Price from '../atoms/Price'
import Tag from '../atoms/Tag'
import WhatsAppButton from '../atoms/WhatsAppButton'
import { Card } from '@/components/ui/card'
import { iconeCategoria } from '@/lib/icones'
import { formatarPreco } from '../../utils/format'

export default function ProductCard({ produto, onComprar, onWhatsApp }) {
  return (
    <Card id={produto.id} className="group gap-0 overflow-hidden rounded-card border-border bg-surface py-0 shadow-none transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      <Midia proporcao="4/3" icone={iconeCategoria[produto.categoria]}>
        <Tag positivo={produto.emEstoque} className="absolute top-3 left-3">
          {produto.emEstoque ? 'Em estoque' : 'Sob encomenda'}
        </Tag>
      </Midia>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h4 className="text-[17px] font-bold">{produto.nome}</h4>
        <p className="flex-1 text-[14px] leading-normal text-text-muted">{produto.descricao}</p>
        <div className="mt-2">
          <Price>{formatarPreco(produto.preco)}</Price>
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
