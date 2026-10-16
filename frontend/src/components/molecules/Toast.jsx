import Spinner from '../atoms/Spinner'

export default function Toast({ mensagem, acao, carregando, onAcao }) {
  return (
    <div
      role="status"
      className="flex animate-toast-in items-center gap-4 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-[13.5px] font-medium text-foreground shadow-pop"
    >
      <span>
        {carregando && <Spinner />}
        {mensagem}
      </span>
      {acao && (
        <button
          type="button"
          onClick={onAcao}
          className="whitespace-nowrap text-[13px] font-semibold text-primary-text underline decoration-neon underline-offset-4"
        >
          {acao}
        </button>
      )}
    </div>
  )
}
