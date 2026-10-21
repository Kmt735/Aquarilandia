import { ShoppingCart } from 'lucide-react'
import FotoPeixe from '../atoms/FotoPeixe'
import Tag from '../atoms/Tag'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
const classeBotao =
  'h-auto min-h-10 min-w-[150px] flex-1 gap-1.5 px-3 py-2 text-center text-[12.5px] leading-tight whitespace-normal'

  export default function PeixeDialog({ peixe, onFechar, onVerificar, onAdicionar }) {
  const ficha = [
    ['Tamanho adulto', peixe.tamanhoAdulto],
    ['Água', peixe.agua],
    ['Temperamento', peixe.temperamento],
    ['Aquário mínimo', peixe.aquarioMinimo],
    ['Dificuldade', peixe.dificuldade],
    ['Cores', peixe.cores],
  ].filter(([, valor]) => valor)

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-auto rounded-[20px] border-border-strong bg-surface-elevated p-6 shadow-pop sm:max-w-[560px]">
        <DialogHeader className="pr-6">
          <DialogTitle className="font-display text-[23px] font-extrabold">{peixe.nome}</DialogTitle>
          <DialogDescription className="italic">{peixe.cientifico}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border">
          <FotoPeixe peixe={peixe} proporcao="16/10" />
        </div>

        {peixe.descricao && <p className="text-[14.5px] leading-relaxed text-text-muted">{peixe.descricao}</p>}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4 text-[13.5px]">
          {ficha.map(([chave, valor]) => (
            <div key={chave} className={chave === 'Cores' ? 'col-span-2' : ''}>
              <dt className="text-[11px] font-bold tracking-[.08em] text-text-muted uppercase">{chave}</dt>
              <dd className="mt-0.5">{valor}</dd>
            </div>
          ))}
        </dl>

        <p className="text-[13.5px] leading-normal text-text-muted">
          Combina com: <b className="font-semibold text-primary-text">{peixe.compativelCom}</b>
        </p>

        <div className="flex flex-col gap-3">
          <Tag positivo={peixe.disponivel} className="self-start">
            {peixe.disponivel ? 'Disponível' : 'Sob consulta'}
          </Tag>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-w-[150px] flex-1" onClick={onVerificar}>
              <WhatsAppIcon className="size-[18px]" />
              Verificar disponibilidade
            </Button>
            <Button className="min-w-[150px] flex-1" onClick={onAdicionar}>
              <ShoppingCart aria-hidden="true" />
              Adicionar ao carrinho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}