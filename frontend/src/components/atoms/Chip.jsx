export default function Chip({ children, ativo = false, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={`select-none rounded-full border px-4 py-2 font-mono text-[11.5px] ${
        ativo ? 'border-cyan bg-cyan font-bold text-bg' : 'border-line bg-panel text-ink-soft'
      }`}
      {...props}
    >
      {children}
    </button>
  )
}
