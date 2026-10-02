import Tip from '../atoms/Tip'

export default function TimelineItem({ ref, numero, passo, guiando, estado, ultimo, marcarHeuristicas = false }) {
  const opacidade = !guiando ? '' : estado === 'atual' ? 'opacity-100' : estado === 'feito' ? 'opacity-75' : 'opacity-40'
  const fundoNumero = estado === 'feito' ? 'bg-mint' : 'bg-linear-135 from-cyan to-cyan-deep'

  return (
    <div ref={ref} className={`relative flex gap-[22px] transition-opacity ${ultimo ? '' : 'pb-11'} ${opacidade}`}>
      {!ultimo && <span className="absolute top-11 bottom-0 left-[19px] w-0.5 bg-line" />}
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full font-mono font-bold text-bg ${fundoNumero} ${
          estado === 'atual' ? 'shadow-[0_0_0_6px_rgba(0,194,214,.22)]' : ''
        }`}
      >
        {numero}
      </div>
      <div>
        <h4 className="mb-[5px] font-display text-base font-bold">
          {passo.titulo}
          {passo.dica && (
            <Tip texto={passo.dica} data-h={marcarHeuristicas ? 'H10 Ajuda contextual' : undefined} />
          )}
        </h4>
        <p className="max-w-[480px] text-[13.5px] leading-normal text-ink-soft">{passo.descricao}</p>
      </div>
    </div>
  )
}
