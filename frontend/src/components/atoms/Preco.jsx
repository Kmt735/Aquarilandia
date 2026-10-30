import { formatarPreco } from '../../utils/format'

const TAMANHOS = { sm: 'text-corpo', md: 'text-h3', lg: 'text-h2' }

// Todo preço do site passa por aqui (e por formatarPreco), para trocar reais por centavos da API num lugar só
export default function Preco({ valor, centavos = false, tamanho = 'md', className = '' }) {
  return (
    <span className={`font-display font-extrabold tracking-[-0.01em] text-foreground tabular-nums ${TAMANHOS[tamanho]} ${className}`}>
      {formatarPreco(valor, { centavos })}
    </span>
  )
}
