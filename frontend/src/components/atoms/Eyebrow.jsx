// Rótulo pequeno acima dos títulos, com um traço neon curto
export default function Eyebrow({ children, className = '' }) {
  return (
    <div
      className={`flex items-center gap-2.5 text-[12px] font-semibold tracking-[.16em] text-primary-text uppercase ${className}`}
    >
      <span aria-hidden="true" className="neon-line h-px w-5" />
      {children}
    </div>
  )
}
