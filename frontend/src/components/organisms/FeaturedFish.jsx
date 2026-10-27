import { Link } from 'react-router'
import FotoPeixe from '../atoms/FotoPeixe'
import Tag from '../atoms/Tag'
import SectionHead from '../molecules/SectionHead'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { peixes } from '../../data/peixes'
import { formatarPreco } from '../../utils/format'
import { ROTAS, urlPeixe } from '../../utils/rotas'

// Vitrine da Home: até 3 peixes marcados como disponíveis
export default function FeaturedFish() {
  const disponiveis = peixes.filter((p) => p.disponivel).slice(0, 3)
  if (disponiveis.length === 0) return null

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 desk:px-10 desk:py-24">
      <SectionHead
        eyebrow="Vitrine"
        titulo="Peixes disponíveis"
        link={{ to: ROTAS.peixes, rotulo: 'Ver todos os peixes' }}
        className="mb-10 flex-wrap"
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 desk:grid-cols-3">
        {disponiveis.map((peixe) => (
          <Card
            key={peixe.id}
            className="gap-0 overflow-hidden rounded-card border-border bg-surface py-0 shadow-none transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <Link to={urlPeixe(peixe.id)} tabIndex={-1} aria-hidden="true" className="block">
              <FotoPeixe peixe={peixe} />
            </Link>
            <div className="flex flex-1 flex-col p-5">
              <Tag className="mb-3 self-start">Disponível</Tag>
              <h4 className="text-[18px]">
                <Link to={urlPeixe(peixe.id)} className="transition-colors hover:text-primary-text hover:underline">
                  {peixe.nome}
                </Link>
              </h4>
              <div className="text-[13px] text-text-muted italic">{peixe.cientifico}</div>
              {peixe.preco != null && (
                <div className="mt-3 font-display text-[22px] font-extrabold text-primary-text tabular-nums">
                  {formatarPreco(peixe.preco)}
                </div>
              )}
              <Button asChild className="mt-4">
                <Link to={urlPeixe(peixe.id)}>Ver peixe</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}