import { ShoppingCart } from 'lucide-react'
import { Link } from 'react-router'
import FotoPeixe from '../atoms/FotoPeixe'
import Tag from '../atoms/Tag'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { urlPeixe } from '../../utils/rotas'

const classeBotao =
  'h-auto min-h-10 min-w-[150px] flex-1 gap-1.5 px-3 py-2 text-center text-[12.5px] leading-tight whitespace-normal'

export default function PeixeCard({ peixe, onVerificar, onAdicionar }) {
  const ficha = [
    ['Água', peixe.agua],
    ['Temperamento', peixe.temperamento],
    ['Aquário mínimo', peixe.aquarioMinimo],
    ['Dificuldade', peixe.dificuldade],
  ]

  return (
    <Card id={peixe.id} className="gap-0 overflow-hidden rounded-card border-border bg-surface py-0 shadow-none transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      {/* A foto é um atalho para o mouse. Quem usa teclado vai pelo nome */}
      <Link to={urlPeixe(peixe.id)} tabIndex={-1} aria-hidden="true" className="block">
        <FotoPeixe peixe={peixe} />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h4 className="text-[18px]">
          <Link
            to={urlPeixe(peixe.id)}
            title="Ver página do peixe"
            className="transition-colors hover:text-primary-text hover:underline"
          >
            {peixe.nome}
          </Link>
        </h4>
        <div className="text-[13px] text-text-muted italic">{peixe.cientifico}</div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4 text-[13.5px]">
          {ficha.map(([chave, valor]) => (
            <div key={chave}>
              <dt className="text-[11px] font-bold tracking-[.08em] text-text-muted uppercase">{chave}</dt>
              <dd className="mt-0.5">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3.5 mb-5 flex-1 text-[13.5px] leading-normal text-text-muted">
          Combina com: <b className="font-semibold text-primary-text">{peixe.compativelCom}</b>
        </p>
        <div className="flex flex-col gap-3">
          <Tag positivo={peixe.disponivel} className="self-start">
            {peixe.disponivel ? 'Disponível' : 'Sob consulta'}
          </Tag>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={classeBotao} onClick={onVerificar}>
              <WhatsAppIcon className="size-4 shrink-0" />
              Verificar disponibilidade
            </Button>
            <Button className={classeBotao} onClick={onAdicionar}>
              <ShoppingCart aria-hidden="true" className="shrink-0" />
              Adicionar ao carrinho
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}