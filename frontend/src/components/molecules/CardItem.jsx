import { Bell, ShoppingCart } from 'lucide-react'
import { Link } from 'react-router'
import Button from '../atoms/Button'
import Imagem from '../atoms/Imagem'
import InfoChip from '../atoms/InfoChip'
import Preco from '../atoms/Preco'
import StatusBadge from '../atoms/StatusBadge'
import { urlItem } from '../../utils/rotas'

// CARD ÚNICO de peixes e produtos (item 4 · consistência; item 34 · raciocínio indutivo; item 38 · ordem
// foto → nome → preço → botão). O card inteiro abre os detalhes (link "esticado" no nome); os botões ficam
// acima dessa camada e não disparam o clique do card.
export default function CardItem({ item, onAdicionar, onAviseMe, nivelTitulo = 3 }) {
  const Titulo = `h${nivelTitulo}`
  const esgotado = item.disponibilidade === 'esgotado'

  return (
    <article
      id={item.id}
      className="group relative flex flex-col overflow-hidden rounded-card border border-border-strong bg-surface transition-[border-color,box-shadow,transform] duration-(--dur-media) ease-saida hover:-translate-y-0.5 hover:border-primary-text/50 hover:shadow-glow has-[a:focus-visible]:shadow-glow"
    >
      <Imagem src={item.imagens[0]?.src} alt={item.imagens[0]?.alt} categoria={item.categoria} />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <StatusBadge tipo={item.disponibilidade} />
          {item.entregaLocal && <StatusBadge tipo="entrega-local" />}
        </div>

        <Titulo className="text-h4">
          <Link
            to={urlItem(item)}
            className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-primary-text focus-visible:text-primary-text"
          >
            {item.nome}
          </Link>
        </Titulo>
        {item.cientifico && <p className="text-legenda text-text-muted italic">{item.cientifico}</p>}

        {item.chips.length > 0 && (
          <ul aria-label="Características" className="mt-3 flex flex-wrap gap-1.5">
            {item.chips.slice(0, 3).map((c) => (
              <InfoChip key={c.id} {...c} />
            ))}
          </ul>
        )}

        <div className="mt-auto pt-4">
          <Preco centavos={item.centavos} valor={item.preco} />
          {item.prazoEncomenda && <p className="text-legenda text-text-muted">Prazo: {item.prazoEncomenda}</p>}
        </div>

        {/* relative z-10: acima do link esticado */}
        <div className="relative z-10 mt-3">
          {esgotado ? (
            <div className="flex flex-col gap-2">
              <Button largo disabled aria-describedby={`${item.id}-esgotado`}>
                Esgotado
              </Button>
              <Button variant="secundario" largo onClick={() => onAviseMe?.(item)}>
                <Bell aria-hidden="true" />
                Avise-me quando chegar
              </Button>
              <span id={`${item.id}-esgotado`} className="sr-only">
                Este item está esgotado no momento.
              </span>
            </div>
          ) : (
            <Button largo onClick={() => onAdicionar?.(item)}>
              <ShoppingCart aria-hidden="true" />
              Adicionar ao carrinho
              <span className="sr-only">: {item.nome}</span>
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

// Mesmo formato, para os estados de carregamento das grades
export function CardItemSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col overflow-hidden rounded-card border border-border-strong bg-surface">
      <div className="aspect-[4/3] animate-pulso bg-surface-muted" />
      <div className="flex flex-col gap-3 p-5">
        <div className="h-6 w-24 animate-pulso rounded-full bg-surface-muted" />
        <div className="h-5 w-3/4 animate-pulso rounded bg-surface-muted" />
        <div className="h-4 w-1/2 animate-pulso rounded bg-surface-muted" />
        <div className="mt-4 h-11 animate-pulso rounded-full bg-surface-muted" />
      </div>
    </div>
  )
}
