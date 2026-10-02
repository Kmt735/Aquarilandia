import EmojiPhoto from '../atoms/EmojiPhoto'
import Tag from '../atoms/Tag'
import WhatsAppButton from '../atoms/WhatsAppButton'

export default function PeixeCard({ peixe, onWhatsApp, marcarHeuristicas = false }) {
  const ficha = [
    ['Água', peixe.agua],
    ['Temperamento', peixe.temperamento],
    ['Aquário mínimo', peixe.aquarioMinimo],
    ['Dificuldade', peixe.dificuldade],
  ]

  return (
    <article id={peixe.id} className="overflow-hidden rounded-card border border-line bg-panel">
      <EmojiPhoto variante="ouro" className="h-[140px] text-4xl">
        {peixe.icone}
      </EmojiPhoto>
      <div className="p-4">
        <h4 className="font-display text-[15px] font-bold">{peixe.nome}</h4>
        <div className="mb-2.5 text-[11px] italic text-ink-soft">{peixe.cientifico}</div>
        <div
          className="mb-3 grid grid-cols-2 gap-2 text-[11.5px]"
          data-h={marcarHeuristicas ? 'H2 Linguagem do aquarista' : undefined}
        >
          {ficha.map(([chave, valor]) => (
            <div key={chave}>
              <span className="block font-mono text-[10px] uppercase text-ink-soft">{chave}</span>
              <span>{valor}</span>
            </div>
          ))}
        </div>
        <p
          className="-mt-0.5 mb-3 text-[11.5px] leading-[1.4] text-ink-soft"
          data-h={marcarHeuristicas ? 'H6 Compatíveis à vista' : undefined}
        >
          Combina com: <b className="font-semibold text-cyan">{peixe.compativelCom}</b>
        </p>
        <div className="flex items-center justify-between">
          <Tag positivo={peixe.disponivel}>{peixe.disponivel ? 'Disponível' : 'Sob consulta'}</Tag>
          <WhatsAppButton onClick={onWhatsApp} label={`Perguntar sobre ${peixe.nome} no WhatsApp`} />
        </div>
      </div>
    </article>
  )
}
