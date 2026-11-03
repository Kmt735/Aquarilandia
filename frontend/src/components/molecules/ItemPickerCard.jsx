import { Check, Plus, ThumbsUp } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Button from '../atoms/Button'
import Imagem from '../atoms/Imagem'
import InfoChip from '../atoms/InfoChip'
import Preco from '../atoms/Preco'
import StatusBadge from '../atoms/StatusBadge'
import CompatibilityWarning from './CompatibilityWarning'
import SeletorQuantidade from './SeletorQuantidade'
import { LIMITE_QTD_MONTAGEM } from '../../lib/montagem'
import { urlItem } from '../../utils/rotas'

// Card de escolha do "Monte seu Aquário": mesma ordem do CardItem (foto → selos → nome → chips → preço),
// mas a ação é escolher/tirar da montagem (aria-pressed) em vez de ir direto ao carrinho.
export default function ItemPickerCard({
  item, selecionado, qtd = 1, onAlternar, onQtd, recomendado = false, chips = [], nota, avisos = [], comQuantidade = true, nivelTitulo = 3,
}) {
  const Titulo = `h${nivelTitulo}`
  const esgotado = !item.emEstoque
  const max = Math.min(item.estoque ?? LIMITE_QTD_MONTAGEM, LIMITE_QTD_MONTAGEM)
  const idTitulo = `item-${item.id}-nome`

  return (
    <article
      aria-labelledby={idTitulo}
      className={cn(
        'flex flex-col overflow-hidden rounded-card border bg-surface transition-[border-color,box-shadow] duration-(--dur-media) ease-saida',
        selecionado ? 'border-primary-text shadow-glow ring-1 ring-primary-text' : 'border-border-strong',
      )}
    >
      <Imagem src={item.imagens[0]?.src} alt={item.imagens[0]?.alt} categoria={item.categoria} proporcao="16/10" compacta />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {recomendado && (
            <Badge variant="info" className="whitespace-normal text-left">
              <ThumbsUp aria-hidden="true" />
              Recomendado para o seu aquário
            </Badge>
          )}
          {esgotado && <StatusBadge tipo="esgotado" />}
        </div>
        <Titulo id={idTitulo} className="text-h4">{item.nome}</Titulo>
        {item.descricao && <p className="mt-1 text-legenda text-text-muted">{item.descricao}</p>}
        {chips.length > 0 && (
          <ul aria-label="Características" className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => <InfoChip key={c.id} {...c} />)}
          </ul>
        )}
        {nota && <div className="mt-3 text-legenda text-foreground">{nota}</div>}
        {avisos.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {avisos.map((a) => <CompatibilityWarning key={a.id} aviso={a} compacto />)}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <Preco valor={item.preco} centavos={item.centavos} tamanho="sm" />
          <Link to={urlItem(item)} className="alvo-toque text-legenda font-semibold text-primary-text underline-offset-4 hover:underline">
            Ver detalhes<span className="sr-only"> de {item.nome}</span>
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {esgotado && !selecionado ? (
            <Button largo disabled>Esgotado</Button>
          ) : (
            <Button largo variant={selecionado ? 'secundario' : 'primario'} aria-pressed={selecionado} onClick={onAlternar}>
              {selecionado ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {selecionado ? 'Escolhido' : 'Escolher'}
              <span className="sr-only">: {item.nome}</span>
            </Button>
          )}
          {selecionado && comQuantidade && (
            <SeletorQuantidade compacto valor={qtd} max={max} onChange={onQtd} rotulo={`Quantidade de ${item.nome}`} />
          )}
        </div>
      </div>
    </article>
  )
}
