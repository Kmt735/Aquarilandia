import { NavLink } from 'react-router'
import useToast from '../../hooks/useToast'
import useUI from '../../hooks/useUI'
import { ROTAS } from '../../utils/rotas'

const telas = [
  { to: ROTAS.inicio, rotulo: 'Início' },
  { to: ROTAS.loja, rotulo: 'Loja / Produtos' },
  { to: ROTAS.peixes, rotulo: 'Peixes' },
  { to: ROTAS.primeiroAquario, rotulo: 'Meu Primeiro Aquário' },
  { to: ROTAS.servicos, rotulo: 'Serviços' },
]

const base = 'whitespace-nowrap rounded-full border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[.05em] transition'

// Barra do protótipo: troca de telas + modo apresentação das heurísticas
export default function PrototypeSwitcher() {
  const { mostrarHeuristicas, alternarHeuristicas } = useUI()
  const { toast } = useToast()

  const alternar = () => {
    if (!mostrarHeuristicas) toast('Elementos marcados com H1–H10 mostram onde cada heurística foi aplicada')
    alternarHeuristicas()
  }

  return (
    <div className="sticky top-0 z-[200] flex gap-1.5 overflow-x-auto border-b border-line bg-night px-4 py-2.5">
      {telas.map((tela) => (
        <NavLink
          key={tela.to}
          to={tela.to}
          end
          className={({ isActive }) =>
            `${base} ${isActive ? 'border-transparent bg-cyan font-bold text-bg' : 'border-line text-[#4E7376] hover:border-cyan hover:text-ink'}`
          }
        >
          {tela.rotulo}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={alternar}
        className={`${base} ml-auto ${mostrarHeuristicas ? 'border-gold bg-gold font-bold text-gold-ink' : 'border-[#5C4A12] text-gold'}`}
      >
        {mostrarHeuristicas ? '◉ Ocultar heurísticas' : '◎ Mostrar heurísticas'}
      </button>
    </div>
  )
}
