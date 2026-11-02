import { RotateCw, TriangleAlert } from 'lucide-react'
import Button from '../atoms/Button'

// Erro de uma seção da Início: uma linha só, sem reservar o espaço do conteúdo que não veio (item 9).
export default function ErroCompacto({ children, onTentar, className = '' }) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-3 rounded-card border border-dashed border-danger-text/50 px-4 py-3 ${className}`}>
      <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-danger-text" />
      <p className="min-w-0 flex-1 text-pequeno text-text-muted">{children}</p>
      {onTentar && (
        <Button variant="secundario" tamanho="sm" onClick={onTentar}>
          <RotateCw aria-hidden="true" />
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
