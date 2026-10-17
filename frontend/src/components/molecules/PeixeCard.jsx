import { Fish } from 'lucide-react'
import Midia from '../atoms/Midia'
import Tag from '../atoms/Tag'
import WhatsAppButton from '../atoms/WhatsAppButton'
import { Card } from '@/components/ui/card'

export default function PeixeCard({ peixe, onWhatsApp }) {
  const ficha = [
    ['Água', peixe.agua],
    ['Temperamento', peixe.temperamento],
    ['Aquário mínimo', peixe.aquarioMinimo],
    ['Dificuldade', peixe.dificuldade],
  ]

  return (
    <Card id={peixe.id} className="neon-hover gap-0 overflow-hidden rounded-card border-border bg-surface py-0 shadow-none">
      <Midia proporcao="4/3" icone={Fish} />
      <div className="flex flex-1 flex-col p-5">
        <h4 className="text-[18px]">{peixe.nome}</h4>
        <div className="text-[13px] text-text-muted italic">{peixe.cientifico}</div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4 text-[13.5px]">
          {ficha.map(([chave, valor]) => (
            <div key={chave}>
              <dt className="text-[11px] font-semibold tracking-[.1em] text-text-muted uppercase">{chave}</dt>
              <dd className="mt-0.5">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3.5 mb-5 flex-1 text-[13.5px] leading-normal text-text-muted">
          Combina com: <b className="font-semibold text-primary-text">{peixe.compativelCom}</b>
        </p>
        <div className="flex items-center justify-between">
          <Tag positivo={peixe.disponivel}>{peixe.disponivel ? 'Disponível' : 'Sob consulta'}</Tag>
          <WhatsAppButton onClick={onWhatsApp} label={`Perguntar sobre ${peixe.nome} no WhatsApp`} />
        </div>
      </div>
    </Card>
  )
}
