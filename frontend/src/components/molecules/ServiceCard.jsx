import { CalendarClock, Receipt } from 'lucide-react'
import { Link } from 'react-router'
import Button from '../atoms/Button'
import { iconeServico } from '@/lib/icones'
import { A_DEFINIR } from '../../data/loja'
import { ROTAS } from '../../utils/rotas'

// Serviço: ícone, descrição, referência de valor/prazo (item 36) e o CTA primário "Solicitar orçamento" (item 4)
export default function ServiceCard({ servico, onOrcamento, compacto = false, nivelTitulo = 2 }) {
  const Icone = iconeServico[servico.id]
  const Titulo = `h${nivelTitulo}`

  return (
    <article className="relative flex h-full flex-col rounded-card border border-border-strong bg-surface p-6 transition-[border-color,box-shadow] duration-(--dur-media) hover:border-primary-text/50 hover:shadow-glow">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-text">
        {Icone && <Icone aria-hidden="true" className="size-6" />}
      </span>
      <Titulo className="mt-5 mb-2 text-h4">
        {compacto ? (
          <Link to={ROTAS.servicos} className="after:absolute after:inset-0 after:content-[''] hover:text-primary-text">
            {servico.nome}
          </Link>
        ) : (
          servico.nome
        )}
      </Titulo>
      <p className="flex-1 text-corpo text-text-muted">{compacto ? (servico.resumo ?? servico.descricao) : servico.descricao}</p>

      {!compacto && (
        <dl className="mt-5 grid gap-2 border-t border-border pt-4 text-pequeno">
          <div className="flex items-center gap-2">
            <Receipt aria-hidden="true" className="size-4 text-primary-text" />
            <dt className="text-text-muted">Valor:</dt>
            <dd className="font-semibold">sob orçamento</dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock aria-hidden="true" className="size-4 text-primary-text" />
            <dt className="text-text-muted">Prazo médio:</dt>
            <dd className="font-semibold">{servico.prazo ?? A_DEFINIR}</dd>
          </div>
        </dl>
      )}

      {onOrcamento && (
        <Button largo className="mt-5" onClick={onOrcamento}>
          Solicitar orçamento
          <span className="sr-only">: {servico.nome}</span>
        </Button>
      )}
    </article>
  )
}
