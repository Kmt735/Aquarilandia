import { CircleAlert } from 'lucide-react'
import { Children, cloneElement, isValidElement } from 'react'
import { Label } from '@/components/ui/label'

// Rótulo + campo + ajuda + erro. Liga o erro ao campo (aria-describedby) e marca aria-invalid.
// O campo recebe `id`, `erro` e `aria-describedby` automaticamente.
export default function FormField({ id, label, obrigatorio = false, ajuda, erro, children, className = '' }) {
  const idAjuda = ajuda ? `${id}-ajuda` : null
  const idErro = erro ? `${id}-erro` : null
  const describedBy = [idErro, idAjuda].filter(Boolean).join(' ') || undefined
  const filho = Children.only(children)

  return (
    <div className={`mb-4 ${className}`}>
      <Label htmlFor={id} className="mb-1.5 text-pequeno font-semibold">
        {label}
        {obrigatorio ? (
          <span className="text-danger-text" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="font-normal text-text-muted">(opcional)</span>
        )}
        {obrigatorio && <span className="sr-only">(obrigatório)</span>}
      </Label>
      {isValidElement(filho) ? cloneElement(filho, { id, erro, 'aria-describedby': describedBy }) : filho}
      {ajuda && !erro && (
        <p id={idAjuda} className="mt-1.5 text-legenda text-text-muted">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className="mt-1.5 flex items-start gap-1.5 text-legenda font-semibold text-danger-text">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  )
}
