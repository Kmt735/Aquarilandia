import { ArrowLeft, Fish, ShoppingCart } from 'lucide-react'
import { Link, useParams } from 'react-router'
import FotoPeixe from '../components/atoms/FotoPeixe'
import Tag from '../components/atoms/Tag'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import EmptyState from '../components/molecules/EmptyState'
import PageTemplate from '../components/templates/PageTemplate'
import { Button } from '@/components/ui/button'
import { buscarPeixe } from '../data/peixes'
import useCart from '../hooks/useCart'
import useWhatsApp from '../hooks/useWhatsApp'
import { formatarPreco } from '../utils/format'
import { ROTAS } from '../utils/rotas'

export default function PeixeDetalhePage() {
  const { id } = useParams()
  const peixe = buscarPeixe(id)
  const { adicionar } = useCart()
  const abrirWhatsApp = useWhatsApp()

  if (!peixe) { 
    return (
      <PageTemplate eyebrow="Peixes" titulo="Peixe não encontrado">
        <div className="px-4 pt-10 sm:px-6 desk:px-10">
          <EmptyState
            icone={<Fish />}
            acoes={
              <Button asChild>
                <Link to={ROTAS.peixes}>Ver todos os peixes</Link>
              </Button>
            }
          >
            Não encontramos esse peixe. Ele pode ter saído do catálogo.
          </EmptyState>
        </div>
      </PageTemplate>
    )
  }

   const ficha = [
    ['Tamanho adulto', peixe.tamanhoAdulto],
    ['Água', peixe.agua],
    ['Temperamento', peixe.temperamento],
    ['Aquário mínimo', peixe.aquarioMinimo],
    ['Dificuldade', peixe.dificuldade],
    ['pH', peixe.ph],
    ['Cores', peixe.cores],
  ].filter(([, valor]) => valor)

  const verificar = () => abrirWhatsApp(`verificar disponibilidade de ${peixe.nome}`)

  return (
    <PageTemplate eyebrow="Peixes" titulo={peixe.nome}>
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 desk:px-10 desk:py-14">
        <Link
          to={ROTAS.peixes}
          className="mb-8 inline-flex items-center gap-2 text-[14px] text-text-muted transition-colors hover:text-primary-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para peixes
        </Link>

        <div className="grid items-start gap-10 desk:grid-cols-2 desk:gap-14">
          <div className="overflow-hidden rounded-card border border-border desk:sticky desk:top-24">
            <FotoPeixe peixe={peixe} />
          </div>

          <div>
            <p className="text-[15px] text-text-muted italic">{peixe.cientifico}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Tag positivo={peixe.disponivel}>{peixe.disponivel ? 'Disponível' : 'Sob consulta'}</Tag>
              {peixe.preco != null && (
                <span className="font-display text-[26px] font-bold text-primary-text">
                  {formatarPreco(peixe.preco)}
                </span>
              )}
            </div>

            {peixe.descricao && (
              <p className="mt-6 text-[16px] leading-relaxed text-text-muted">{peixe.descricao}</p>
            )}

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-6 text-[14.5px]">
              {ficha.map(([chave, valor]) => (
                <div key={chave} className={chave === 'Cores' ? 'col-span-2' : ''}>
                  <dt className="text-[11.5px] font-bold tracking-[.08em] text-text-muted uppercase">{chave}</dt>
                  <dd className="mt-1">{valor}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 text-[14.5px] leading-normal text-text-muted">
              Combina com: <b className="font-semibold text-primary-text">{peixe.compativelCom}</b>
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={verificar}>
                <WhatsAppIcon className="size-[18px]" />
                Verificar disponibilidade
              </Button>
              <Button size="lg" className="flex-1 sm:flex-none" onClick={() => adicionar(peixe)}>
                <ShoppingCart aria-hidden="true" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageTemplate>
  )
}