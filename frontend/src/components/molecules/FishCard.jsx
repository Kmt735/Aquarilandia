import EmojiPhoto from '../atoms/EmojiPhoto'

export default function FishCard({ peixe, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[220px] shrink-0 overflow-hidden rounded-card border border-line bg-panel text-left"
    >
      <EmojiPhoto className="h-[130px] text-[34px]">{peixe.icone}</EmojiPhoto>
      <div className="p-3.5">
        <h4 className="mb-1 font-display text-sm font-bold">{peixe.nome}</h4>
        <div className="mb-2 text-[11px] italic text-ink-soft">{peixe.cientifico}</div>
        <div className="font-mono text-[11px] text-gold">{peixe.dificuldade}</div>
      </div>
    </button>
  )
}
