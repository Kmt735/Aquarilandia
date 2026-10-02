export default function CloseButton({ label = 'Fechar', className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`size-[34px] shrink-0 rounded-full border border-line bg-transparent text-ink hover:border-cyan ${className}`}
      {...props}
    >
      ✕
    </button>
  )
}
