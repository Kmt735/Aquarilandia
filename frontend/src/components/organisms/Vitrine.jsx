import { ArrowRight, Fish } from 'lucide-react'
import { Link } from 'react-router'
import Button from '../atoms/Button'
import CardItem, { CardItemSkeleton } from '../molecules/CardItem'
import EmptyState from '../molecules/EmptyState'
import SectionHead from '../molecules/SectionHead'
import useCart from '../../hooks/useCart'
import useUI from '../../hooks/useUI'

const COLUNAS = { 1: 'desk:grid-cols-2', 2: 'desk:grid-cols-3', 3: 'desk:grid-cols-4' }

// Vitrine da Início: até 3 itens + um card "Ver todos" que fecha a grade (nunca sobra vazio, item 8).
// No celular vira uma fileira com rolagem lateral, para a página não ficar infinita (item 19).
export default function Vitrine({ id, eyebrow, titulo, descricao, consulta, verTodos }) {
  const { adicionar } = useCart()
  const { abrirAviseMe } = useUI()
  const { dados, carregando, erro, recarregar } = consulta
  const itens = (dados ?? []).slice(0, 3)
  const total = carregando ? 3 : itens.length

  const lista = 'flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 desk:gap-6'
  const celula = 'w-[78%] shrink-0 snap-start sm:w-auto'

  return (
    <section aria-labelledby={id} className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 desk:px-10 desk:py-20">
      <SectionHead id={id} eyebrow={eyebrow} titulo={titulo} descricao={descricao} />
      {erro ? (
        <EmptyState tom="erro" icone={<Fish />} titulo="Não conseguimos carregar agora" acoes={<Button onClick={recarregar}>Tentar de novo</Button>}>
          Confira sua conexão e tente de novo.
        </EmptyState>
      ) : (
        <ul aria-busy={carregando} className={`${lista} ${COLUNAS[total] ?? 'desk:grid-cols-4'}`}>
          {carregando
            ? [0, 1, 2].map((i) => (
                <li key={i} className={celula}>
                  <CardItemSkeleton />
                </li>
              ))
            : itens.map((item) => (
                <li key={item.id} className={`${celula} flex [&>*]:flex-1`}>
                  <CardItem item={item} onAdicionar={adicionar} onAviseMe={abrirAviseMe} />
                </li>
              ))}
          <li className={`${celula} ${total % 2 === 0 ? 'sm:col-span-2 desk:col-span-1' : ''}`}>
            <Link
              to={verTodos.to}
              className="group flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-card text-center border border-dashed border-border-control bg-surface-tint p-6 transition-[border-color,box-shadow] hover:border-primary-text hover:shadow-glow"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-text transition-transform group-hover:translate-x-1">
                <ArrowRight aria-hidden="true" className="size-6" />
              </span>
              <span className="font-display text-h4 font-extrabold group-hover:text-primary-text">{verTodos.rotulo}</span>
              {verTodos.descricao && <span className="text-pequeno text-text-muted">{verTodos.descricao}</span>}
            </Link>
          </li>
        </ul>
      )}
      {carregando && <p className="sr-only">Carregando…</p>}
    </section>
  )
}
