import { Columns3, X } from 'lucide-react'
import { Link } from 'react-router'
import Button from '../atoms/Button'
import { ROTAS } from '../../utils/rotas'

export const MAX_COMPARAR = 3

// Barra fixa da comparação de peixes (item 6 · reconhecer em vez de lembrar; item 30 · memória)
export default function CompareBar({ selecionados, onLimpar }) {
  if (selecionados.length === 0) return null
  return (
    <div role="region" aria-label="Comparação de peixes" className="sticky bottom-4 z-(--z-flutuante) mx-auto mb-6 flex max-w-[640px] flex-wrap items-center gap-3 rounded-2xl border border-primary-text/40 bg-surface-elevated px-4 py-3 shadow-glow">
      <Columns3 aria-hidden="true" className="size-5 text-primary-text" />
      <p className="flex-1 text-pequeno font-semibold">
        {selecionados.length} de {MAX_COMPARAR} peixes para comparar
        {selecionados.length < 2 && <span className="block text-legenda font-normal text-text-muted">Escolha pelo menos 2.</span>}
      </p>
      <Button variant="terciario" tamanho="sm" onClick={onLimpar}>
        <X aria-hidden="true" />
        Limpar
      </Button>
      {selecionados.length >= 2 ? (
        <Button asChild>
          <Link to={`${ROTAS.compararPeixes}?ids=${selecionados.join(',')}`}>Comparar agora</Link>
        </Button>
      ) : (
        <Button disabled>Comparar agora</Button>
      )}
    </div>
  )
}
