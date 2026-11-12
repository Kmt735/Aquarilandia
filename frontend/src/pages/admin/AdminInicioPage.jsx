import { Package } from 'lucide-react'
import { Link } from 'react-router'
import { ROTAS } from '../../utils/rotas'

export default function AdminInicioPage() {
  return (
    <section aria-labelledby="titulo-resumo">
      <h2 id="titulo-resumo" className="mb-6 text-h3">
        O que você quer fazer?
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to={ROTAS.adminProdutos}
          className="flex gap-4 rounded-card border border-border-strong bg-surface p-6 transition-colors hover:border-primary-text"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
            <Package aria-hidden="true" className="size-6" />
          </span>
          <span>
            <span className="block font-display text-h3 font-extrabold">Produtos</span>
            <span className="mt-1 block text-pequeno text-text-muted">
              Veja os produtos ativos e inativos e reative o que voltou para a loja.
            </span>
          </span>
        </Link>
      </div>
    </section>
  )
}