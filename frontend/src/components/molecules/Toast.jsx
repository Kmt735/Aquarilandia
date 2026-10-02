import Spinner from '../atoms/Spinner'

export default function Toast({ mensagem, acao, carregando, onAcao }) {
  return (
    <div
      role="status"
      className="flex animate-toast-in items-center gap-3.5 rounded-[10px] bg-foam px-4 py-3 text-[13px] font-semibold text-bg shadow-[0_10px_30px_rgba(0,0,0,.45)]"
    >
      <span>
        {carregando && <Spinner />}
        {mensagem}
      </span>
      {acao && (
        <button type="button" onClick={onAcao} className="whitespace-nowrap text-[13px] font-extrabold text-cyan-deep">
          {acao}
        </button>
      )}
    </div>
  )
}
