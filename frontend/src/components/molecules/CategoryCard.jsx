export default function CategoryCard({ icone, rotulo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card border border-line bg-panel px-[18px] py-6 text-center transition hover:-translate-y-[3px] hover:border-cyan"
    >
      <div className="mb-2.5 text-[28px]">{icone}</div>
      <span className="text-[13px] font-bold">{rotulo}</span>
    </button>
  )
}
