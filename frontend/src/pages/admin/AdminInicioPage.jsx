import { ClipboardList, Package } from 'lucide-react'
import { Link } from 'react-router'
import { ROTAS } from '../../utils/rotas'

const CARTOES = [
  { to: ROTAS.adminPedidos, Icone: ClipboardList, titulo: 'Pedidos', texto: 'Veja os pedidos que chegaram e atualize o andamento, o pagamento e a entrega.' },
  { to: ROTAS.adminProdutos, Icone: Package, titulo: 'Peixes e produtos', texto: 'Cadastre, edite e tire da loja o que não está disponível.' },
]

export default function AdminInicioPage() {
  return (
    <section aria-labelledby="titulo-resumo">
      <h2 id="titulo-resumo" className="mb-6 text-h3">
        O que você quer fazer?
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARTOES.map(({ to, Icone, titulo, texto }) => (
          <Link key={to} to={to} className="flex gap-4 rounded-card border border-border-strong bg-surface p-6 transition-colors hover:border-primary-text">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
              <Icone aria-hidden="true" className="size-6" />
            </span>
            <span>
              <span className="block font-display text-h3 font-extrabold">{titulo}</span>
              <span className="mt-1 block text-pequeno text-text-muted">{texto}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}