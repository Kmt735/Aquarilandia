import { MessageCircle, SearchX, WifiOff } from 'lucide-react'
import Button from '../atoms/Button'
import CardItem, { CardItemSkeleton } from '../molecules/CardItem'
import EmptyState from '../molecules/EmptyState'
import useCart from '../../hooks/useCart'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'

// Grade de cards com os estados: carregando (skeleton), erro (com "Tentar de novo") e vazio útil (item 9)
export default function GradeItens({ itens, carregando, erro, onRecarregar, onLimpar, assuntoWhatsApp, renderExtra, dica }) {
  const { adicionar } = useCart()
  const { abrirAviseMe } = useUI()
  const abrirWhatsApp = useWhatsApp()
  const grade = 'grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 desk:gap-6'

  if (carregando) {
    return (
      <div aria-busy="true" className={grade}>
        <span className="sr-only">Carregando…</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <CardItemSkeleton key={i} />
        ))}
      </div>
    )
  }

  // Filtro inválido na URL (ex.: mínimo maior que o máximo, categoria que não existe): explica e oferece limpar
  if (erro && [400, 404].includes(erro.status)) {
    return (
      <EmptyState icone={<SearchX />} titulo="Não deu para aplicar esses filtros" acoes={<Button onClick={onLimpar}>Limpar filtros</Button>}>
        {erro.erro ?? erro.message ?? 'Algum filtro do link não é válido.'} Limpe os filtros e escolha de novo.
      </EmptyState>
    )
  }

  if (erro) {
    return (
      <EmptyState tom="erro" icone={<WifiOff />} titulo="Não conseguimos carregar a lista" acoes={<Button onClick={onRecarregar}>Tentar de novo</Button>}>
        Pode ser a conexão. Tente de novo em alguns segundos.
      </EmptyState>
    )
  }

  if (itens.length === 0) {
    return (
      <EmptyState
        icone={<SearchX />}
        titulo="Nenhum resultado"
        acoes={
          <>
            <Button onClick={onLimpar}>Limpar filtros</Button>
            <Button variant="secundario" onClick={() => abrirWhatsApp(assuntoWhatsApp)}>
              <MessageCircle aria-hidden="true" />
              Fale com a gente
            </Button>
          </>
        }
      >
        {dica ?? 'Tente remover um filtro ou buscar por outro nome.'} Se preferir, fale com a gente: a loja física pode ter o que você procura.
      </EmptyState>
    )
  }

  return (
    <ul className={grade}>
      {itens.map((item) => (
        <li key={item.id} className="flex flex-col [&>article]:flex-1">
          <CardItem item={item} onAdicionar={adicionar} onAviseMe={abrirAviseMe} nivelTitulo={2} />
          {renderExtra?.(item)}
        </li>
      ))}
    </ul>
  )
}
