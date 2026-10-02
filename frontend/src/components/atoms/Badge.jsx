export default function Badge({ children, animar = false }) {
  return (
    <span
      className={`absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-[5px] font-mono text-[10px] font-extrabold text-gold-ink ${animar ? 'animate-bump' : ''}`}
    >
      {children}
    </span>
  )
}
