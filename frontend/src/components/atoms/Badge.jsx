// Contador do carrinho: neon com texto escuro (contraste 12:1 nos dois temas)
export default function Badge({ children, animar = false }) {
  return (
    <span
      className={`absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-neon px-1 text-[10.5px] font-semibold text-on-neon shadow-neon ring-2 ring-surface ${animar ? 'animate-bump' : ''}`}
    >
      {children}
    </span>
  )
}
