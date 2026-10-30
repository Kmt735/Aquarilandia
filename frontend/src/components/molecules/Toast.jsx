import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import Spinner from '../atoms/Spinner'

const ICONES = {
  sucesso: <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-success-text" />,
  erro: <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-danger-text" />,
  info: <Info aria-hidden="true" className="size-5 shrink-0 text-info-text" />,
  carregando: <Spinner className="shrink-0 text-primary-text" />,
}

export default function Toast({ mensagem, tipo, acao, onAcao, onFechar }) {
  return (
    <div className="pointer-events-auto flex w-full animate-toast-in items-center gap-3 rounded-2xl border border-border-strong bg-surface-elevated py-2 pr-2 pl-4 text-pequeno font-medium text-foreground shadow-pop">
      {ICONES[tipo]}
      <span className="min-w-0 flex-1 py-1.5">{mensagem}</span>
      {acao && (
        <button
          type="button"
          onClick={onAcao}
          className="alvo-toque shrink-0 rounded-full px-2 py-1 text-pequeno font-bold whitespace-nowrap text-primary-text underline decoration-accent decoration-2 underline-offset-4"
        >
          {acao}
        </button>
      )}
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar aviso"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-tint hover:text-primary-text"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
