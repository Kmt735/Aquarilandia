export default function ProgressBar({ valor }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-abyss">
      <div
        className="h-full bg-linear-to-r from-cyan to-mint transition-[width] duration-250"
        style={{ width: `${valor * 100}%` }}
      />
    </div>
  )
}
